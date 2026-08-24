package handler

import (
	"api/config"
	"api/service"
	"api/utility"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const oauthStateCookie = "oauth_state"

// googleUserinfo — respons `GET https://www.googleapis.com/oauth2/v2/userinfo`.
type googleUserinfo struct {
	Email         string `json:"email"`
	Name          string `json:"name"`
	VerifiedEmail bool   `json:"verified_email"`
}

// OAuthHandler — alur login Google (E-AUTH-2026 R12). Exchange token dilakukan
// SERVER-SIDE (client secret di server) — access token tidak pernah lewat URL
// atau frontend. SPA pulih session lewat boot refresh (cookie) setelah
// redirect kembali ke frontend.
type OAuthHandler struct {
	enabled      bool
	oauthConfig  *oauth2.Config
	oauthService service.OAuthService
	tokenService service.TokenService
	auditService service.AuditService
}

func NewOAuthHandler(
	cfg config.GoogleConfig,
	enabled bool,
	oauthService service.OAuthService,
	tokenService service.TokenService,
	auditService service.AuditService,
) *OAuthHandler {
	h := &OAuthHandler{
		enabled:      enabled,
		oauthService: oauthService,
		tokenService: tokenService,
		auditService: auditService,
	}
	if enabled {
		h.oauthConfig = &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}
	return h
}

func (h *OAuthHandler) requireEnabled(c echo.Context) error {
	if !h.enabled {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "Google OAuth belum dikonfigurasi")
	}
	return nil
}

// GoogleLogin godoc
// @Summary      Login with Google
// @Description  Redirect ke Google OAuth (state di cookie, anti-CSRF)
// @Tags         auth
// @Success      302
// @Router       /auth/google [get]
func (h *OAuthHandler) GoogleLogin(c echo.Context) error {
	if err := h.requireEnabled(c); err != nil {
		return err
	}
	// State acak → cookie httpOnly sementara (5 menit), diverifikasi di
	// callback untuk mencegah CSRF pada alur OAuth.
	state := make([]byte, 32)
	if _, err := rand.Read(state); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "gagal membuat state")
	}
	stateHex := hex.EncodeToString(state)
	c.SetCookie(&http.Cookie{
		Name:     oauthStateCookie,
		Value:    stateHex,
		Path:     "/api/v1/auth/google",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   5 * 60,
	})
	return c.Redirect(http.StatusFound, h.oauthConfig.AuthCodeURL(stateHex))
}

// GoogleCallback godoc
// @Summary      Google OAuth callback
// @Description  Tukar code → profil → buat/link akun → set session → redirect ke frontend
// @Tags         auth
// @Success      302
// @Router       /auth/google/callback [get]
func (h *OAuthHandler) GoogleCallback(c echo.Context) error {
	if err := h.requireEnabled(c); err != nil {
		return err
	}
	redirectFail := func() error {
		return c.Redirect(http.StatusFound, utility.AppBaseURL()+"/login?error=google")
	}

	// Verifikasi state (anti-CSRF): cookie harus sama dengan query param.
	stateCookie, err := c.Cookie(oauthStateCookie)
	if err != nil || stateCookie.Value == "" || stateCookie.Value != c.QueryParam("state") {
		return redirectFail()
	}
	clearStateCookie(c)

	code := c.QueryParam("code")
	if code == "" {
		return redirectFail()
	}
	tok, err := h.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return redirectFail()
	}
	info, err := h.fetchUserInfo(tok.AccessToken)
	if err != nil {
		return redirectFail()
	}

	user, err := h.oauthService.LoginOrCreateUser(service.GoogleUserInfo{
		Email:         info.Email,
		Name:          info.Name,
		EmailVerified: info.VerifiedEmail,
	})
	if err != nil || user == nil {
		return redirectFail()
	}

	if _, raw, err := h.tokenService.IssueSession(user.ID, user.Email, c.Request().UserAgent(), c.RealIP()); err != nil {
		return redirectFail()
	} else {
		setRefreshCookie(c, raw)
	}
	_ = h.auditService.Record(&user.ID, service.ActionGoogleLogin, nil, c.RealIP(), c.Request().UserAgent())
	// Access token TIDAK dikirim ke browser — SPA memulihkan session via
	// boot refresh (POST /auth/refresh memakai cookie).
	return c.Redirect(http.StatusFound, utility.AppBaseURL())
}

// fetchUserInfo mengambil profil user dari Google memakai access token hasil
// exchange (server-side).
func (h *OAuthHandler) fetchUserInfo(accessToken string) (*googleUserinfo, error) {
	req, err := http.NewRequest(http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var info googleUserinfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func clearStateCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/api/v1/auth/google",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
