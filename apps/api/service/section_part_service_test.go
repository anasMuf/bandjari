package service

import (
	"api/dto"
	"api/model"
	"errors"
	"testing"
)

// setupPartEnv membangun Song → Section → SectionPart dengan slots + service.
func setupPartEnv(t *testing.T, isTemplate bool) (*sectionPartService, uint, *fakePartRepo) {
	t.Helper()
	song := &model.Song{Name: "Lagu", Bpm: 90}
	if isTemplate {
		song.IsSystemTemplate = true
	} else {
		song.UserID = uptr(5)
	}
	songRepo := newFakeSongRepo(song)
	sectionRepo := newFakeSectionRepo()
	sec := &model.Section{SongID: 1, Name: "Dasar"}
	sectionRepo.assignIDs(sec)
	sectionRepo.sections[sec.ID] = sec

	steps := "T,D,T,D"
	part := &model.SectionPart{
		SectionID: sec.ID,
		Part:      model.PartRebana1,
		Steps:     &steps,
		SoundSlots: []model.SoundSlot{
			{Label: "Tak", Key: "T", OrderIndex: 0},
			{Label: "Dung", Key: "D", OrderIndex: 1},
		},
	}
	partRepo := &fakePartRepo{parts: map[uint]*model.SectionPart{1: part}}
	part.ID = 1
	partRepo.parts[1] = part

	svc := NewSectionPartService(partRepo, sectionRepo, songRepo).(*sectionPartService)
	return svc, part.ID, partRepo
}

func TestUpdateSteps_Valid(t *testing.T) {
	svc, partID, _ := setupPartEnv(t, false)
	steps := "T,T,D,D"
	res, err := svc.UpdateSteps(5, false, partID, dto.UpdateStepsRequest{Steps: &dto.NullableString{Set: true, Value: &steps}})
	if err != nil {
		t.Fatal(err)
	}
	if res.Steps == nil || *res.Steps != "T,T,D,D" {
		t.Fatalf("steps = %v, want T,T,D,D", res.Steps)
	}
}

func TestUpdateSteps_InvalidCharRejected(t *testing.T) {
	svc, partID, _ := setupPartEnv(t, false)
	steps := "T,K,T,K" // K tidak terdaftar
	_, err := svc.UpdateSteps(5, false, partID, dto.UpdateStepsRequest{Steps: &dto.NullableString{Set: true, Value: &steps}})
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("err = %v, want ErrBadRequest (FR-SEQ-02)", err)
	}
}

func TestUpdateSteps_NullClears(t *testing.T) {
	svc, partID, _ := setupPartEnv(t, false)
	res, err := svc.UpdateSteps(5, false, partID, dto.UpdateStepsRequest{Steps: &dto.NullableString{Set: true, Value: nil}})
	if err != nil {
		t.Fatal(err)
	}
	if res.Steps != nil {
		t.Fatalf("steps = %v, want nil (FR-SEQ-04)", res.Steps)
	}
}

func TestUpdateSteps_TemplateSongForbidden(t *testing.T) {
	svc, partID, _ := setupPartEnv(t, true)
	steps := "T,T"
	_, err := svc.UpdateSteps(5, false, partID, dto.UpdateStepsRequest{Steps: &dto.NullableString{Set: true, Value: &steps}})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SONG-08)", err)
	}
}

// TestUpdateSteps_TemplateSongAdminAllowed — admin boleh mengedit steps milik
// Song Template System (FR-ROLE).
func TestUpdateSteps_TemplateSongAdminAllowed(t *testing.T) {
	svc, partID, _ := setupPartEnv(t, true)
	steps := "T,T,D,D"
	res, err := svc.UpdateSteps(5, true, partID, dto.UpdateStepsRequest{Steps: &dto.NullableString{Set: true, Value: &steps}})
	if err != nil {
		t.Fatalf("admin UpdateSteps() error = %v", err)
	}
	if res.Steps == nil || *res.Steps != "T,T,D,D" {
		t.Fatalf("steps = %v, want T,T,D,D", res.Steps)
	}
}

func TestListBySection_UserSongGuestGetsNotFound(t *testing.T) {
	svc, _, _ := setupPartEnv(t, false)
	_, err := svc.ListBySection(nil, 1)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound (FR-AUTH-05)", err)
	}
}

func TestListBySection_TemplateAccessibleToGuest(t *testing.T) {
	svc, _, _ := setupPartEnv(t, true)
	res, err := svc.ListBySection(nil, 1)
	if err != nil {
		t.Fatalf("Guest seharusnya bisa lihat parts Song Template (FR-AUTH-04), err = %v", err)
	}
	if len(res) != 1 || len(res[0].SoundSlots) != 2 {
		t.Fatalf("parts/slots salah: %+v", res)
	}
}

// setupPartEnvPublicSong membangun env dengan lagu public (FR-VIS) — Guest
// boleh melihat parts-nya, sama seperti template.
func setupPartEnvPublicSong(t *testing.T) (*sectionPartService, uint, *fakePartRepo) {
	t.Helper()
	song := &model.Song{UserID: uptr(5), Name: "Publik", Bpm: 90, Visibility: string(model.VisibilityPublic)}
	songRepo := newFakeSongRepo(song)
	sectionRepo := newFakeSectionRepo()
	sec := &model.Section{SongID: 1, Name: "Dasar"}
	sectionRepo.assignIDs(sec)
	sectionRepo.sections[sec.ID] = sec

	steps := "T,D"
	part := &model.SectionPart{SectionID: sec.ID, Part: model.PartRebana1, Steps: &steps}
	partRepo := &fakePartRepo{parts: map[uint]*model.SectionPart{1: part}}
	part.ID = 1

	svc := NewSectionPartService(partRepo, sectionRepo, songRepo).(*sectionPartService)
	return svc, part.ID, partRepo
}

func TestListBySection_PublicSongAccessibleToGuest(t *testing.T) {
	svc, _, _ := setupPartEnvPublicSong(t)
	res, err := svc.ListBySection(nil, 1)
	if err != nil {
		t.Fatalf("Guest seharusnya bisa lihat parts lagu public (FR-VIS), err = %v", err)
	}
	if len(res) != 1 {
		t.Fatalf("len = %d, want 1", len(res))
	}
}

func TestListBySection_PublicSongAccessibleToAnyUser(t *testing.T) {
	svc, _, _ := setupPartEnvPublicSong(t)
	if _, err := svc.ListBySection(uptr(99), 1); err != nil {
		t.Fatalf("user lain seharusnya bisa lihat parts lagu public (FR-VIS), err = %v", err)
	}
}

func TestListBySection_OwnerOK(t *testing.T) {
	svc, _, _ := setupPartEnv(t, false)
	res, err := svc.ListBySection(uptr(5), 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 1 {
		t.Fatalf("len = %d, want 1", len(res))
	}
}
