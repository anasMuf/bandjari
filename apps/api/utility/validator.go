package utility

import (
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

type CustomValidator struct {
	Validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.Validator.Struct(i); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			var errMsg string
			for _, e := range validationErrors {
				switch e.Tag() {
				case "required":
					errMsg = e.Field() + " is required"
				case "email":
					errMsg = e.Field() + " must be a valid email address"
				case "min":
					errMsg = e.Field() + " must be at least " + e.Param() + " characters"
				case "max":
					errMsg = e.Field() + " must be at most " + e.Param() + " characters"
				default:
					errMsg = e.Field() + " is invalid"
				}
				// We can just return the first error found for simplicity
				return echo.NewHTTPError(http.StatusBadRequest, errMsg)
			}
		}
		// Fallback for other types of errors
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return nil
}
