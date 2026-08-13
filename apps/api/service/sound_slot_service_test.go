package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"errors"
	"testing"

	"gorm.io/gorm"
)

type fakePartRepo struct {
	parts map[uint]*model.SectionPart
}

func (f *fakePartRepo) FindByID(id uint) (*model.SectionPart, error) {
	if p, ok := f.parts[id]; ok {
		return p, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakePartRepo) FindByIDWithSlots(id uint) (*model.SectionPart, error) {
	return f.FindByID(id)
}

func (f *fakePartRepo) ListBySectionID(sectionID uint) ([]model.SectionPart, error) {
	var res []model.SectionPart
	for _, p := range f.parts {
		if p.SectionID == sectionID {
			res = append(res, *p)
		}
	}
	return res, nil
}

func (f *fakePartRepo) Save(part *model.SectionPart) error {
	f.parts[part.ID] = part
	return nil
}

type fakeSlotRepo struct {
	slots  map[uint]*model.SoundSlot
	nextID uint
}

func newFakeSlotRepo() *fakeSlotRepo {
	return &fakeSlotRepo{slots: map[uint]*model.SoundSlot{}, nextID: 1}
}

func (f *fakeSlotRepo) Create(slot *model.SoundSlot) error {
	slot.ID = f.nextID
	f.nextID++
	f.slots[slot.ID] = slot
	return nil
}

func (f *fakeSlotRepo) FindByID(id uint) (*model.SoundSlot, error) {
	if s, ok := f.slots[id]; ok {
		return s, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeSlotRepo) ListBySectionPartID(partID uint) ([]model.SoundSlot, error) {
	var res []model.SoundSlot
	for _, s := range f.slots {
		if s.SectionPartID == partID {
			res = append(res, *s)
		}
	}
	return res, nil
}

func (f *fakeSlotRepo) CountByKey(sectionPartID uint, key string) (int64, error) {
	var c int64
	for _, s := range f.slots {
		if s.SectionPartID == sectionPartID && s.Key == key {
			c++
		}
	}
	return c, nil
}

func (f *fakeSlotRepo) CountByKeyExcluding(sectionPartID uint, key string, excludeID uint) (int64, error) {
	var c int64
	for _, s := range f.slots {
		if s.ID != excludeID && s.SectionPartID == sectionPartID && s.Key == key {
			c++
		}
	}
	return c, nil
}

func (f *fakeSlotRepo) MaxOrderIndex(sectionPartID uint) (int, error) {
	max := -1
	for _, s := range f.slots {
		if s.SectionPartID == sectionPartID && s.OrderIndex > max {
			max = s.OrderIndex
		}
	}
	return max, nil
}

func (f *fakeSlotRepo) Save(slot *model.SoundSlot) error {
	f.slots[slot.ID] = slot
	return nil
}

func (f *fakeSlotRepo) Delete(id uint) error {
	if _, ok := f.slots[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(f.slots, id)
	return nil
}

// setupSlotEnv membangun rantai Song → Section → SectionPart + service.
// steps berisi steps milik part (bisa nil).
func setupSlotEnv(t *testing.T, steps *string) (*soundSlotService, *fakeSlotRepo, uint) {
	t.Helper()
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	sec, err := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo()).Create(5, 1, dto.CreateSectionRequest{Name: "Dasar"})
	if err != nil {
		t.Fatal(err)
	}
	// ambil part rebana1
	partID := sectionRepo.sections[sec.ID].Parts[0].ID
	partRepo := &fakePartRepo{parts: map[uint]*model.SectionPart{
		partID: {SectionID: sec.ID, Part: model.PartRebana1, Steps: steps},
	}}
	partRepo.parts[partID].ID = partID
	slotRepo := newFakeSlotRepo()
	svc := NewSoundSlotService(slotRepo, partRepo, sectionRepo, songRepo, newFakeSampleRepo()).(*soundSlotService)
	return svc, slotRepo, partID
}

func TestSlotCreate_DuplicateKeyBadRequest(t *testing.T) {
	svc, slotRepo, partID := setupSlotEnv(t, nil)
	// pre-populate slot dengan key T
	slotRepo.slots[1] = &model.SoundSlot{SectionPartID: partID, Label: "Tak", Key: "T"}
	slotRepo.nextID = 2

	_, err := svc.Create(5, partID, dto.CreateSoundSlotRequest{Label: "Tak Lain", Key: "T"})
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("err = %v, want ErrBadRequest (FR-SLOT-02)", err)
	}
}

func TestSlotCreate_Success(t *testing.T) {
	svc, _, partID := setupSlotEnv(t, nil)
	res, err := svc.Create(5, partID, dto.CreateSoundSlotRequest{Label: "Duk", Key: "K"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Key != "K" || res.Label != "Duk" {
		t.Fatalf("response salah: %+v", res)
	}
}

func TestSlotCreate_OtherUsersSampleForbidden(t *testing.T) {
	svc, _, partID := setupSlotEnv(t, nil)
	sampleRepo := svc.sampleRepo.(*fakeSampleRepo)
	sampleRepo.samples[9] = &model.Sample{UserID: uptr(99), Name: "Punya Orang", Part: model.PartRebana1}
	sampleRepo.nextID = 10

	_, err := svc.Create(5, partID, dto.CreateSoundSlotRequest{Label: "Duk", Key: "K", SampleID: uptr(9)})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-AUTH-02)", err)
	}
}

func TestSlotCreate_TemplateSampleAllowed(t *testing.T) {
	svc, _, partID := setupSlotEnv(t, nil)
	sampleRepo := svc.sampleRepo.(*fakeSampleRepo)
	sampleRepo.samples[9] = &model.Sample{IsSystemTemplate: true, Name: "Rebana1 Tak", Part: model.PartRebana1}
	sampleRepo.nextID = 10

	res, err := svc.Create(5, partID, dto.CreateSoundSlotRequest{Label: "Tak 2", Key: "X", SampleID: uptr(9)})
	if err != nil {
		t.Fatal(err)
	}
	if res.SampleID == nil || *res.SampleID != 9 {
		t.Fatalf("sample_id = %v, want 9 (FR-SAMP-13)", res.SampleID)
	}
}

func TestSlotUpdate_KeyChangeWhileUsedInSteps(t *testing.T) {
	steps := "TDTD"
	svc, slotRepo, partID := setupSlotEnv(t, &steps)
	slot := &model.SoundSlot{SectionPartID: partID, Label: "Tak", Key: "T"}
	slot.ID = 1
	slotRepo.slots[1] = slot
	slotRepo.nextID = 2

	newKey := "X"
	_, err := svc.Update(5, 1, dto.UpdateSoundSlotRequest{Key: &newKey})
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("err = %v, want ErrBadRequest (FR-SLOT-06)", err)
	}
}

func TestSlotUpdate_DetachSample(t *testing.T) {
	svc, slotRepo, partID := setupSlotEnv(t, nil)
	sid := uint(9)
	slot := &model.SoundSlot{SectionPartID: partID, Label: "Tak", Key: "T", SampleID: &sid}
	slot.ID = 1
	slotRepo.slots[1] = slot
	slotRepo.nextID = 2

	res, err := svc.Update(5, 1, dto.UpdateSoundSlotRequest{SampleID: &dto.NullableUint{Set: true, Value: nil}})
	if err != nil {
		t.Fatal(err)
	}
	if res.SampleID != nil {
		t.Fatal("sample_id seharusnya terlepas (FR-SAMP-10)")
	}
}

func TestSlotDelete_KeyUsedInStepsConflict(t *testing.T) {
	steps := "TDTD"
	svc, slotRepo, partID := setupSlotEnv(t, &steps)
	slot := &model.SoundSlot{SectionPartID: partID, Label: "Tak", Key: "T"}
	slot.ID = 1
	slotRepo.slots[1] = slot
	slotRepo.nextID = 2

	err := svc.Delete(5, 1)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("err = %v, want ErrConflict (FR-SLOT-05)", err)
	}
}

func TestSlotDelete_Success(t *testing.T) {
	svc, slotRepo, partID := setupSlotEnv(t, nil)
	slot := &model.SoundSlot{SectionPartID: partID, Label: "Duk", Key: "K"}
	slot.ID = 1
	slotRepo.slots[1] = slot
	slotRepo.nextID = 2

	if err := svc.Delete(5, 1); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if _, ok := slotRepo.slots[1]; ok {
		t.Fatal("slot harus terhapus")
	}
}

var _ repository.SoundSlotRepository = (*fakeSlotRepo)(nil)
var _ repository.SectionPartRepository = (*fakePartRepo)(nil)
