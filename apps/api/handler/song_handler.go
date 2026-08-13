package handler

import (
	"api/dto"
	"api/service"
	"api/utility"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type SongHandler struct {
	songService service.SongService
}

func NewSongHandler(songService service.SongService) *SongHandler {
	return &SongHandler{songService: songService}
}

func parseIDParam(c echo.Context, name string) (uint, error) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "Invalid id: "+name)
	}
	return uint(id), nil
}

// ListSongs godoc
// @Summary      List user songs
// @Description  Daftar Song milik user yang sedang login
// @Tags         songs
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Router       /songs [get]
func (h *SongHandler) ListSongs(c echo.Context) error {
	userID := utility.GetCurrentUserID(c)
	songs, err := h.songService.List(*userID)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Song retrieved successfully", Data: songs})
}

// ListTemplates godoc
// @Summary      List song templates
// @Description  Daftar Song Template System — dapat diakses Guest maupun User login
// @Tags         songs
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.SuccessResponse
// @Router       /songs/templates [get]
func (h *SongHandler) ListTemplates(c echo.Context) error {
	songs, err := h.songService.ListTemplates()
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Song templates retrieved successfully", Data: songs})
}

// CreateSong godoc
// @Summary      Create song
// @Description  Buat Song baru (nama, BPM) milik user yang login
// @Tags         songs
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        request  body      dto.CreateSongRequest  true  "Song details"
// @Success      201      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Router       /songs [post]
func (h *SongHandler) CreateSong(c echo.Context) error {
	var req dto.CreateSongRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	song, err := h.songService.Create(*userID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{Message: "Song created successfully", Data: song})
}

// GetSong godoc
// @Summary      Get song by id
// @Description  Detail Song. Song Template System dapat diakses Guest; Song milik User hanya pemiliknya.
// @Tags         songs
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "Song ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /songs/{id} [get]
func (h *SongHandler) GetSong(c echo.Context) error {
	songID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	currentUserID := utility.GetCurrentUserID(c)
	song, err := h.songService.GetByID(songID, currentUserID)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Song retrieved successfully", Data: song})
}

// UpdateSong godoc
// @Summary      Update song
// @Description  Update nama/BPM Song milik user. Ditolak 403 untuk Song Template System.
// @Tags         songs
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                   true  "Song ID"
// @Param        request  body      dto.UpdateSongRequest  true  "Song update"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /songs/{id} [put]
func (h *SongHandler) UpdateSong(c echo.Context) error {
	songID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.UpdateSongRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	song, err := h.songService.Update(*userID, songID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Song updated successfully", Data: song})
}

// DeleteSong godoc
// @Summary      Delete song
// @Description  Hapus Song beserta seluruh Section (cascade). Ditolak 403 untuk Song Template System.
// @Tags         songs
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "Song ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /songs/{id} [delete]
func (h *SongHandler) DeleteSong(c echo.Context) error {
	songID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	if err := h.songService.Delete(*userID, songID); err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Song deleted successfully"})
}

// DuplicateSong godoc
// @Summary      Duplicate song
// @Description  Duplikasi Song (deep copy Section/SectionPart/SoundSlot). Hasil milik user login.
// @Tags         songs
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "Song ID"
// @Success      201  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /songs/{id}/duplicate [post]
func (h *SongHandler) DuplicateSong(c echo.Context) error {
	songID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	song, err := h.songService.Duplicate(*userID, songID)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{Message: "Song duplicated successfully", Data: song})
}
