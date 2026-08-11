package dto

type ErrorResponse struct {
	Status  int         `json:"status,omitempty"`
	Code    string      `json:"code,omitempty"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}
