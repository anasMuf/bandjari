package handler

import (
	"api/service"
	"api/utility"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

// mapServiceError memetakan sentinel error service ke HTTP error sesuai TDD Bagian 6.7.
func mapServiceError(err error) *echo.HTTPError {
	switch {
	case errors.Is(err, service.ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrForbidden):
		return echo.NewHTTPError(http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrConflict):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, service.ErrBadRequest):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, utility.ErrFileTooLarge):
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, err.Error())
	case errors.Is(err, utility.ErrUnsupportedFormat):
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	default:
		return echo.NewHTTPError(http.StatusInternalServerError, "Internal Server Error")
	}
}
