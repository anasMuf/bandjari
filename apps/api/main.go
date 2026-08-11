// @title           Starter Kit API
// @version         1.0
// @description     Ini adalah API starter kit menggunakan Echo Go.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api

// @securityDefinitions.apikey  ApiKeyAuth
// @in                          header
// @name                        Authorization

package main

import (
	"api/config"
	"api/handler"
	"api/middleware"
	"api/model"
	"api/repository"
	_ "api/docs"
	"api/service"
	"api/utility"
	"os"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	echoSwagger "github.com/swaggo/echo-swagger"
)

func main() {
	config.LoadEnv()
	db := config.DBInit()

	if err := db.AutoMigrate(
		&model.User{},
	); err != nil {
		panic("Gagal auto-migrate tabel: " + err.Error())
	}

	//repository
	userRepo := repository.NewUserRepository(db)
	//service
	userService := service.NewUserService(userRepo)
	//handler
	userHandler := handler.NewUserHandler(userService)

	e := echo.New()
	e.Validator = &utility.CustomValidator{Validator: validator.New()}
	e.Use(middleware.MiddlewareLogging)
	e.Use(echoMiddleware.CORS())

	e.HTTPErrorHandler = handler.CustomHTTPErrorHandler

	api := e.Group("/api")
	api.POST("/users/register", userHandler.CreateUser)
	api.POST("/users/login", userHandler.LoginUser)

	// Middleware untuk JWT
	auth := api.Group("")
	auth.Use(middleware.JWTAuth)

	// GET /api/users
	auth.GET("/users", userHandler.GetUser)

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	e.Logger.Fatal(e.Start(":" + port))
}
