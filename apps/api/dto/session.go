package dto

import "time"

// SessionResponse — satu sesi aktif user (E-PROFILE-2026 R9/R10).
// Current=true menandakan sesi yang sedang dipakai (refresh cookie ini).
type SessionResponse struct {
	ID        uint      `json:"id"`
	UserAgent string    `json:"user_agent,omitempty"`
	IP        string    `json:"ip,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Current   bool      `json:"current"`
}
