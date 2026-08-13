package handler

import (
	"api/dto"
	"api/model"
	"api/service"
	"api/utility"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
)

type SampleHandler struct {
	sampleService service.SampleService
}

func NewSampleHandler(sampleService service.SampleService) *SampleHandler {
	return &SampleHandler{sampleService: sampleService}
}

// ListSamples godoc
// @Summary      List user samples
// @Description  Daftar Sample milik user login (filter opsional ?part=)
// @Tags         samples
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        part  query     string  false  "Filter part (rebana1-4, bass)"
// @Success      200   {object}  dto.SuccessResponse
// @Failure      400   {object}  dto.ErrorResponse
// @Failure      401   {object}  dto.ErrorResponse
// @Router       /samples [get]
func (h *SampleHandler) ListSamples(c echo.Context) error {
	userID := utility.GetCurrentUserID(c)
	var part *model.Part
	if raw := c.QueryParam("part"); raw != "" {
		p := model.Part(raw)
		part = &p
	}
	samples, err := h.sampleService.List(*userID, part)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Sample retrieved successfully", Data: samples})
}

// UploadSample godoc
// @Summary      Upload sample
// @Description  Upload file audio .wav (maks 5MB) sebagai Sample milik user
// @Tags         samples
// @Accept       multipart/form-data
// @Produce      json
// @Security     ApiKeyAuth
// @Param        file  formData  file    true  "File audio .wav"
// @Param        name  formData  string  true  "Nama sample"
// @Param        part  formData  string  true  "Part (rebana1-4, bass)"
// @Success      201   {object}  dto.SuccessResponse
// @Failure      400   {object}  dto.ErrorResponse
// @Failure      401   {object}  dto.ErrorResponse
// @Failure      413   {object}  dto.ErrorResponse
// @Failure      415   {object}  dto.ErrorResponse
// @Router       /samples [post]
func (h *SampleHandler) UploadSample(c echo.Context) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "File wajib diunggah")
	}
	name := c.FormValue("name")
	part := model.Part(c.FormValue("part"))

	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Nama sample wajib diisi")
	}

	src, err := fileHeader.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Gagal membaca file")
	}
	defer src.Close()

	data, err := io.ReadAll(io.LimitReader(src, utility.MaxSampleSizeBytes+1))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Gagal membaca file")
	}

	userID := utility.GetCurrentUserID(c)
	sample, err := h.sampleService.Upload(*userID, part, name, data)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{Message: "Sample uploaded successfully", Data: sample})
}

// RenameSample godoc
// @Summary      Rename sample
// @Description  Ganti nama Sample milik user. Ditolak 403 untuk Sample Template System.
// @Tags         samples
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                     true  "Sample ID"
// @Param        request  body      dto.RenameSampleRequest true  "Nama baru"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /samples/{id} [put]
func (h *SampleHandler) RenameSample(c echo.Context) error {
	sampleID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.RenameSampleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	sample, err := h.sampleService.Rename(*userID, sampleID, req.Name)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Sample updated successfully", Data: sample})
}

// DeleteSample godoc
// @Summary      Delete sample
// @Description  Hapus Sample milik user. Ditolak 409 bila masih direferensikan SoundSlot, 403 untuk template.
// @Tags         samples
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "Sample ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Failure      409  {object}  dto.ErrorResponse
// @Router       /samples/{id} [delete]
func (h *SampleHandler) DeleteSample(c echo.Context) error {
	sampleID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	if err := h.sampleService.Delete(*userID, sampleID); err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Sample deleted successfully"})
}

// GetPlaybackURL godoc
// @Summary      Get sample playback URL
// @Description  Signed URL sementara (60 menit) untuk memutar file audio. Template dapat diakses Guest.
// @Tags         samples
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "Sample ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /samples/{id}/playback-url [get]
func (h *SampleHandler) GetPlaybackURL(c echo.Context) error {
	sampleID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	currentUserID := utility.GetCurrentUserID(c)
	url, err := h.sampleService.PlaybackURL(currentUserID, sampleID)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Playback URL generated", Data: dto.PlaybackURLResponse{URL: url}})
}
