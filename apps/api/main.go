// @title           BandJari API
// @version         1.0
// @description     API untuk BandJari — penyusun & pemutar pola pukulan rebana Al-Banjari.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey  ApiKeyAuth
// @in                          header
// @name                        Authorization

package main

import (
	"api/config"
	_ "api/docs"
	"api/handler"
	"api/middleware"
	"api/model"
	"api/repository"
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
	if os.Getenv("JWT_SECRET") == "" {
		println("WARNING: JWT_SECRET kosong — token lama akan tidak valid saat secret berubah. Isi JWT_SECRET di .env dan restart API.")
	}
	db := config.DBInit()

	if err := db.AutoMigrate(
		&model.User{},
		&model.Sample{},
		&model.Song{},
		&model.Section{},
		&model.SectionPart{},
		&model.SoundSlot{},
	); err != nil {
		panic("Gagal auto-migrate tabel: " + err.Error())
	}
	if err := config.EnsureConstraints(db); err != nil {
		panic("Gagal memasang constraint: " + err.Error())
	}

	//repository
	userRepo := repository.NewUserRepository(db)
	songRepo := repository.NewSongRepository(db)
	sectionRepo := repository.NewSectionRepository(db)
	sampleRepo := repository.NewSampleRepository(db)
	sectionPartRepo := repository.NewSectionPartRepository(db)
	soundSlotRepo := repository.NewSoundSlotRepository(db)
	//service
	userService := service.NewUserService(userRepo)
	songService := service.NewSongService(songRepo)
	sectionService := service.NewSectionService(sectionRepo, songRepo, sampleRepo)
	sectionPartService := service.NewSectionPartService(sectionPartRepo, sectionRepo, songRepo)
	soundSlotService := service.NewSoundSlotService(soundSlotRepo, sectionPartRepo, sectionRepo, songRepo, sampleRepo)

	// Object storage opsional di startup — modul lain tetap jalan bila belum dikonfigurasi.
	var storageService service.StorageService
	if svc, err := service.NewStorageService(config.LoadStorageConfig()); err != nil {
		println("WARNING: object storage belum dikonfigurasi — fitur Sample nonaktif:", err.Error())
	} else {
		storageService = svc
	}
	sampleService := service.NewSampleService(sampleRepo, storageService)
	//handler
	userHandler := handler.NewUserHandler(userService)
	songHandler := handler.NewSongHandler(songService)
	sectionHandler := handler.NewSectionHandler(sectionService)
	sampleHandler := handler.NewSampleHandler(sampleService)
	sectionPartHandler := handler.NewSectionPartHandler(sectionPartService)
	soundSlotHandler := handler.NewSoundSlotHandler(soundSlotService)

	e := echo.New()
	e.Validator = &utility.CustomValidator{Validator: validator.New()}
	e.Use(middleware.MiddlewareLogging)
	// CORS eksplisit: di produksi hanya origin bandjari.net yang diizinkan
	// (lihat config/cors.go); dev lokal tanpa env = izinkan semua origin.
	// AllowHeaders disetel eksplisit agar preflight Authorization/Content-Type pasti lolos.
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOrigins: config.LoadCORSAllowedOrigins(),
		AllowMethods: echoMiddleware.DefaultCORSConfig.AllowMethods,
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
		},
		MaxAge: 86400,
	}))

	e.HTTPErrorHandler = handler.CustomHTTPErrorHandler

	api := e.Group("/api/v1")
	api.POST("/auth/register", userHandler.CreateUser)
	api.POST("/auth/login", userHandler.LoginUser)

	// Middleware untuk JWT — role disinkronkan dari DB agar perubahan role
	// langsung berlaku (FR-ROLE).
	jwtAuth := middleware.JWTAuth(userRepo)
	auth := api.Group("")
	auth.Use(jwtAuth)

	// GET /api/v1/users
	auth.GET("/users", userHandler.GetUser)

	// Song — GET /:id memakai auth opsional (akses Guest untuk Song Template System, TDD 6.8)
	api.GET("/songs/templates", songHandler.ListTemplates, middleware.OptionalAuth)
	api.GET("/songs/:id", songHandler.GetSong, middleware.OptionalAuth)

	songs := api.Group("/songs")
	songs.Use(jwtAuth)
	songs.GET("", songHandler.ListSongs)
	songs.POST("", songHandler.CreateSong)
	songs.PUT("/:id", songHandler.UpdateSong)
	songs.DELETE("/:id", songHandler.DeleteSong)
	songs.POST("/:id/duplicate", songHandler.DuplicateSong)

	// Section (semua mutasi wajib login; akses diwarisi dari Song induk — TDD 6.8)
	songs.POST("/:songId/sections", sectionHandler.CreateSection)
	api.PUT("/sections/:id", sectionHandler.UpdateSection, jwtAuth)
	api.PUT("/sections/:id/reorder", sectionHandler.ReorderSection, jwtAuth)
	api.DELETE("/sections/:id", sectionHandler.DeleteSection, jwtAuth)
	api.POST("/sections/:id/duplicate", sectionHandler.DuplicateSection, jwtAuth)

	// SectionPart & SoundSlot (Sequencer)
	api.GET("/sections/:id/parts", sectionPartHandler.ListSectionParts, middleware.OptionalAuth)
	api.PUT("/section-parts/:id", sectionPartHandler.UpdateSteps, jwtAuth)
	api.POST("/section-parts/:id/sound-slots", soundSlotHandler.CreateSoundSlot, jwtAuth)
	api.PUT("/sound-slots/:id", soundSlotHandler.UpdateSoundSlot, jwtAuth)
	api.DELETE("/sound-slots/:id", soundSlotHandler.DeleteSoundSlot, jwtAuth)

	// Sample — playback URL auth opsional (Guest boleh putar Sample Template System)
	api.GET("/samples/templates", sampleHandler.ListTemplates, middleware.OptionalAuth)
	api.GET("/samples/:id/playback-url", sampleHandler.GetPlaybackURL, middleware.OptionalAuth)
	samples := api.Group("/samples")
	samples.Use(jwtAuth)
	samples.GET("", sampleHandler.ListSamples)
	samples.POST("", sampleHandler.UploadSample)
	samples.PUT("/:id", sampleHandler.RenameSample)
	samples.DELETE("/:id", sampleHandler.DeleteSample)

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	e.Logger.Fatal(e.Start(":" + port))
}
