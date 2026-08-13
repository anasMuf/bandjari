package handler

import (
	"api/dto"
	"api/service"
	"api/utility"
	"net/http"

	"github.com/labstack/echo/v4"
)

type SectionPartHandler struct {
	partService service.SectionPartService
}

func NewSectionPartHandler(partService service.SectionPartService) *SectionPartHandler {
	return &SectionPartHandler{partService: partService}
}

// ListSectionParts godoc
// @Summary      List section parts
// @Description  Daftar 5 SectionPart milik Section beserta SoundSlots (nested). Section Song Template dapat dilihat Guest.
// @Tags         section-parts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "Section ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /sections/{id}/parts [get]
func (h *SectionPartHandler) ListSectionParts(c echo.Context) error {
	sectionID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	currentUserID := utility.GetCurrentUserID(c)
	parts, err := h.partService.ListBySection(currentUserID, sectionID)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Section parts retrieved successfully", Data: parts})
}

// UpdateSteps godoc
// @Summary      Update section part steps
// @Description  Update rumus pukulan (steps) — tiap karakter harus merujuk key SoundSlot pada SectionPart terkait
// @Tags         section-parts
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                    true  "SectionPart ID"
// @Param        request  body      dto.UpdateStepsRequest true  "Steps baru"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /section-parts/{id} [put]
func (h *SectionPartHandler) UpdateSteps(c echo.Context) error {
	partID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.UpdateStepsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	userID := utility.GetCurrentUserID(c)
	part, err := h.partService.UpdateSteps(*userID, partID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "Steps updated successfully", Data: part})
}
