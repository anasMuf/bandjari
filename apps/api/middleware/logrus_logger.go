// middleware/logrus_logger.go
package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"
)

// makeLogEntry akan mengembalikan Logrus Entry dengan field utama dari request Echo
func MakeLogEntry(c echo.Context) *log.Entry {
	if c == nil {
		return log.WithFields(log.Fields{
			"at": time.Now().Format("2006-01-02 15:04:05"),
		})
	}
	req := c.Request()
	return log.WithFields(log.Fields{
		"at":     time.Now().Format("2006-01-02 15:04:05"),
		"method": req.Method,
		"uri":    req.URL.String(),
		"ip":     req.RemoteAddr,
	})
}

func MiddlewareLogging(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		MakeLogEntry(c).Info("incoming request")
		return next(c)
	}
}
