package handler

import (
	"api/config"
	"api/dto"
	"api/model"
	"api/repository"
	"api/service"
	"api/utility"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const oauthStateCookie = "oauth_state"
const oauthStateLinkPrefix = "link:"

// googleUserinfo — respons `GET https://www.googleapis.com/oauth2/v2/userinfo`.
type googleUserinfo struct {
	// ID adalah sub stable dari Google — basis match (provider, provider_subject)
	// di OAuthService (E-PROFILE-2026 V1-A).
	ID            string `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	VerifiedEmail bool   `json:"verified_email"`
}

// OAuthHandler — alur login Google (E-AUTH-2026 R12) + link/unlink provider
// (E-PROFILE-2026). Exchange token dilakukan SERVER-SIDE (client secret di
// server) — access token tidak pernah lewat URL atau frontend. SPA pulih
// session lewat boot refresh (cookie) setelah redirect kembali ke frontend.
type OAuthHandler struct {
	enabled      bool
	oauthConfig  *oauth2.Config
	oauthService service.OAuthService
	tokenService service.TokenService
	refreshRepo  repository.RefreshTokenRepository
	auditService service.AuditService
}

func NewOAuthHandler(
	cfg config.GoogleConfig,
	enabled bool,
	oauthService service.OAuthService,
	tokenService service.TokenService,
	refreshRepo repository.RefreshTokenRepository,
	auditService service.AuditService,
) *OAuthHandler {
	h := &OAuthHandler{
		enabled:      enabled,
		oauthService: oauthService,
		tokenService: tokenService,
		refreshRepo:  refreshRepo,
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
// @Description  Redirect ke Google OAuth (state di cookie, anti-CSRF).
// @Description  Param `link=1` menandakan mode LINK (hubungkan Google ke akun
// @Description  yang sedang login) — dipakai dari halaman Profile.
// @Tags         auth
// @Param        link query int false "1 = mode link (akun sudah login)"
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
	stateValue := hex.EncodeToString(state)
	if c.QueryParam("link") == "1" {
		stateValue = oauthStateLinkPrefix + stateValue
	}
	c.SetCookie(&http.Cookie{
		Name:     oauthStateCookie,
		Value:    stateValue,
		Path:     "/api/v1/auth/google",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   5 * 60,
	})
	return c.Redirect(http.StatusFound, h.oauthConfig.AuthCodeURL(stateValue))
}

// GoogleCallback godoc
// @Summary      Google OAuth callback
// @Description  Tukar code → profil → buat/link akun → set session → redirect ke frontend.
// @Description  Mode link (state diawali "link:") → hubungkan provider ke user
// @Description  sesi aktif (validasi refresh cookie) → redirect /profile.
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
	linkMode := strings.HasPrefix(stateCookie.Value, oauthStateLinkPrefix)
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

	// Mode link: hubungkan Google ke user yang sedang login (bukan login baru).
	if linkMode {
		return h.handleLinkMode(c, info)
	}

	user, err := h.oauthService.LoginOrCreateUser(service.GoogleUserInfo{
		Email:           info.Email,
		Name:            info.Name,
		EmailVerified:   info.VerifiedEmail,
		ProviderSubject: info.ID,
	})
	if err != nil {
		// Akun ber-password belum terhubung Google — arahkan ke link eksplisit
		// dari pengaturan (V1-A).
		if errors.Is(err, service.ErrSocialLinkRequired) {
			return c.Redirect(http.StatusFound, utility.AppBaseURL()+"/login?error=google-link")
		}
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

// handleLinkMode — mode link (?link=1): validasi sesi aktif via refresh cookie,
// lalu hubungkan provider Google ke user sesi. Tidak menerbitkan session baru.
func (h *OAuthHandler) handleLinkMode(c echo.Context, info *googleUserinfo) error {
	cookie, err := c.Cookie(utility.RefreshTokenCookieName)
	if err != nil || cookie.Value == "" {
		// Tidak ada sesi → tidak bisa link; minta login dulu.
		return c.Redirect(http.StatusFound, utility.AppBaseURL()+"/login")
	}
	token, err := h.refreshRepo.FindByTokenHash(utility.HashToken(cookie.Value))
	if err != nil || token.RevokedAt != nil || time.Now().After(token.ExpiresAt) {
		return c.Redirect(http.StatusFound, utility.AppBaseURL()+"/login")
	}
	if err := h.oauthService.LinkProvider(token.UserID, string(model.ProviderGoogle), info.ID); err != nil {
		// Subject sudah milik akun lain / user tidak ada → kembali ke profile
		// dengan penanda gagal.
		return c.Redirect(http.StatusFound, utility.AppBaseURL()+"/profile?error=google-link")
	}
	uid := token.UserID
	_ = h.auditService.Record(&uid, service.ActionProviderLink, map[string]any{"provider": string(model.ProviderGoogle)}, c.RealIP(), c.Request().UserAgent())
	return c.Redirect(http.StatusFound, utility.AppBaseURL()+"/profile?linked=google")
}

// UnlinkGoogle godoc
// @Summary      Unlink Google provider
// @Description  Putuskan hubungan Google dari akun. Ditolak (409) bila ini
// @Description  satu-satunya metode login (tanpa password & tanpa provider lain).
// @Tags         auth
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      409  {object}  dto.ErrorResponse
// @Router       /auth/providers/google [delete]
func (h *OAuthHandler) UnlinkGoogle(c echo.Context) error {
	if err := h.requireEnabled(c); err != nil {
		return err
	}
	userID, ok := c.Get("user_id").(uint)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "user_id tidak ditemukan di konteks")
	}
	if err := h.oauthService.UnlinkProvider(userID, string(model.ProviderGoogle)); err != nil {
		if errors.Is(err, service.ErrLastLoginMethod) {
			return echo.NewHTTPError(http.StatusConflict, err.Error())
		}
		if errors.Is(err, service.ErrUserNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	_ = h.auditService.Record(&userID, service.ActionProviderUnlink, map[string]any{"provider": string(model.ProviderGoogle)}, c.RealIP(), c.Request().UserAgent())
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Google diputuskan dari akun"})
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
