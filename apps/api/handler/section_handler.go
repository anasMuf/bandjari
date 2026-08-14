package handler

import (
	"api/dto"
	"api/service"
	"api/utility"
	"net/http"

	"github.com/labstack/echo/v4"
)

type SectionHandler struct {
	sectionService service.SectionService
}

func NewSectionHandler(sectionService service.SectionService) *SectionHandler {
	return &SectionHandler{sectionService: sectionService}
}

// CreateSection godoc
// @Summary      Create section
// @Description  Tambah Section baru (nama bebas) — otomatis dibuat 5 SectionPart (satu per Part)
// @Tags         sections
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        songId   path      int                     true  "Song ID"
// @Param        request  body      dto.CreateSectionRequest true  "Section details"
// @Success      201      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /songs/{songId}/sections [post]
func (h *SectionHandler) CreateSection(c echo.Context) error {
	songID, err := parseIDParam(c, "songId")
	if err != nil {
		return err
	}
	var req dto.CreateSectionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	section, err := h.sectionService.Create(*userID, utility.IsAdmin(c), songID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{Message: "Section created successfully", Data: section})
}

// UpdateSection godoc
// @Summary      Update section
// @Description  Update nama dan/atau bpm_override (null untuk kembali mengikuti BPM Song)
// @Tags         sections
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                      true  "Section ID"
// @Param        request  body      dto.UpdateSectionRequest true  "Section update"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /sections/{id} [put]
func (h *SectionHandler) UpdateSection(c echo.Context) error {
	sectionID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.UpdateSectionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	section, err := h.sectionService.Update(*userID, utility.IsAdmin(c), sectionID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Section updated successfully", Data: section})
}

// ReorderSection godoc
// @Summary      Reorder section
// @Description  Pindahkan Section ke posisi baru; seluruh order_index dinormalkan ulang
// @Tags         sections
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                        true  "Section ID"
// @Param        request  body      dto.ReorderSectionRequest  true  "Posisi baru"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /sections/{id}/reorder [put]
func (h *SectionHandler) ReorderSection(c echo.Context) error {
	sectionID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.ReorderSectionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	sections, err := h.sectionService.Reorder(*userID, utility.IsAdmin(c), sectionID, req.OrderIndex)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Section reordered successfully", Data: sections})
}

// DeleteSection godoc
// @Summary      Delete section
// @Description  Hapus Section beserta seluruh SectionPart (cascade)
// @Tags         sections
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "Section ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /sections/{id} [delete]
func (h *SectionHandler) DeleteSection(c echo.Context) error {
	sectionID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	if err := h.sectionService.Delete(*userID, utility.IsAdmin(c), sectionID); err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Section deleted successfully"})
}

// DuplicateSection godoc
// @Summary      Duplicate section
// @Description  Duplikasi Section dalam Song yang sama (starting point variasi baru)
// @Tags         sections
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "Section ID"
// @Success      201  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /sections/{id}/duplicate [post]
func (h *SectionHandler) DuplicateSection(c echo.Context) error {
	sectionID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	section, err := h.sectionService.Duplicate(*userID, utility.IsAdmin(c), sectionID)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{Message: "Section duplicated successfully", Data: section})
}
