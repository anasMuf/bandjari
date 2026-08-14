package handler

import (
	"api/dto"
	"api/service"
	"api/utility"
	"net/http"

	"github.com/labstack/echo/v4"
)

type SoundSlotHandler struct {
	slotService service.SoundSlotService
}

func NewSoundSlotHandler(slotService service.SoundSlotService) *SoundSlotHandler {
	return &SoundSlotHandler{slotService: slotService}
}

// CreateSoundSlot godoc
// @Summary      Create sound slot
// @Description  Tambah SoundSlot (jenis bunyi) pada SectionPart — key unik per SectionPart
// @Tags         sound-slots
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                        true  "SectionPart ID"
// @Param        request  body      dto.CreateSoundSlotRequest true  "SoundSlot details"
// @Success      201      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /section-parts/{id}/sound-slots [post]
func (h *SoundSlotHandler) CreateSoundSlot(c echo.Context) error {
	partID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.CreateSoundSlotRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	slot, err := h.slotService.Create(*userID, utility.IsAdmin(c), partID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusCreated, dto.SuccessResponse{Message: "SoundSlot created successfully", Data: slot})
}

// UpdateSoundSlot godoc
// @Summary      Update sound slot
// @Description  Update label/key/sample_id (sample_id null untuk melepas referensi). Ubah key yang masih dipakai steps ditolak 400.
// @Tags         sound-slots
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id       path      int                        true  "SoundSlot ID"
// @Param        request  body      dto.UpdateSoundSlotRequest true  "SoundSlot update"
// @Success      200      {object}  dto.SuccessResponse
// @Failure      400      {object}  dto.ErrorResponse
// @Failure      401      {object}  dto.ErrorResponse
// @Failure      403      {object}  dto.ErrorResponse
// @Failure      404      {object}  dto.ErrorResponse
// @Router       /sound-slots/{id} [put]
func (h *SoundSlotHandler) UpdateSoundSlot(c echo.Context) error {
	slotID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req dto.UpdateSoundSlotRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid JSON")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	slot, err := h.slotService.Update(*userID, utility.IsAdmin(c), slotID, req)
	if err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "SoundSlot updated successfully", Data: slot})
}

// DeleteSoundSlot godoc
// @Summary      Delete sound slot
// @Description  Hapus SoundSlot. Ditolak 409 bila key masih dipakai di steps.
// @Tags         sound-slots
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "SoundSlot ID"
// @Success      200  {object}  dto.SuccessResponse
// @Failure      401  {object}  dto.ErrorResponse
// @Failure      403  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Failure      409  {object}  dto.ErrorResponse
// @Router       /sound-slots/{id} [delete]
func (h *SoundSlotHandler) DeleteSoundSlot(c echo.Context) error {
	slotID, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	userID := utility.GetCurrentUserID(c)
	if err := h.slotService.Delete(*userID, utility.IsAdmin(c), slotID); err != nil {
		return mapServiceError(err)
	}
	return c.JSON(http.StatusOK, dto.SuccessResponse{Message: "SoundSlot deleted successfully"})
}
