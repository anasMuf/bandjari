package service

import (
	"api/dto"
	"api/model"
	"api/repository"
	"errors"
	"testing"

	"gorm.io/gorm"
)

type fakeSectionRepo struct {
	sections map[uint]*model.Section
	nextID   uint
}

func newFakeSectionRepo() *fakeSectionRepo {
	return &fakeSectionRepo{sections: map[uint]*model.Section{}, nextID: 1}
}

func (f *fakeSectionRepo) assignIDs(section *model.Section) {
	section.ID = f.nextID
	f.nextID++
	for i := range section.Parts {
		section.Parts[i].ID = f.nextID
		section.Parts[i].SectionID = section.ID
		f.nextID++
		for j := range section.Parts[i].SoundSlots {
			section.Parts[i].SoundSlots[j].ID = f.nextID
			section.Parts[i].SoundSlots[j].SectionPartID = section.Parts[i].ID
			f.nextID++
		}
	}
}

func (f *fakeSectionRepo) Create(section *model.Section) error {
	f.assignIDs(section)
	f.sections[section.ID] = section
	return nil
}

func (f *fakeSectionRepo) FindByID(id uint) (*model.Section, error) {
	if s, ok := f.sections[id]; ok {
		return s, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeSectionRepo) FindByIDWithParts(id uint) (*model.Section, error) {
	return f.FindByID(id)
}

func (f *fakeSectionRepo) ListBySongID(songID uint) ([]model.Section, error) {
	var res []model.Section
	for _, s := range f.sections {
		if s.SongID == songID {
			res = append(res, *s)
		}
	}
	// urutkan manual (fake tidak query DB)
	for i := 0; i < len(res); i++ {
		for j := i + 1; j < len(res); j++ {
			if res[j].OrderIndex < res[i].OrderIndex {
				res[i], res[j] = res[j], res[i]
			}
		}
	}
	return res, nil
}

func (f *fakeSectionRepo) CountBySongID(songID uint) (int64, error) {
	var count int64
	for _, s := range f.sections {
		if s.SongID == songID {
			count++
		}
	}
	return count, nil
}

func (f *fakeSectionRepo) Save(section *model.Section) error {
	f.sections[section.ID] = section
	return nil
}

func (f *fakeSectionRepo) UpdateOrderIndex(id uint, orderIndex int) error {
	if s, ok := f.sections[id]; ok {
		s.OrderIndex = orderIndex
		return nil
	}
	return gorm.ErrRecordNotFound
}

func (f *fakeSectionRepo) Delete(id uint) error {
	if _, ok := f.sections[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(f.sections, id)
	return nil
}

func (f *fakeSectionRepo) WithTransaction(fn func(repo repository.SectionRepository) error) error {
	return fn(f)
}

func TestSectionCreate_AutoCreatesFiveParts(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	sec, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: "Awalan"})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if sec.OrderIndex != 0 {
		t.Fatalf("order_index = %d, want 0", sec.OrderIndex)
	}

	stored := sectionRepo.sections[sec.ID]
	if len(stored.Parts) != 5 {
		t.Fatalf("jumlah SectionPart = %d, want 5 (FR-SEC-02)", len(stored.Parts))
	}
	seen := map[model.Part]bool{}
	for _, p := range stored.Parts {
		seen[p.Part] = true
	}
	if len(seen) != 5 {
		t.Fatalf("Part harus unik & lengkap, got %v", seen)
	}
}

// TestSectionCreate_PartsStartWithoutSlots memastikan Section baru TIDAK membuat
// SoundSlot apapun — keputusan pemilik produk: susunan standar belum final,
// jadi grid Sequencer mulai benar-benar kosong (0 baris), diisi manual lewat
// "+ Tambah Bunyi" (FR-SLOT-01).
func TestSectionCreate_PartsStartWithoutSlots(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	// Sedikan template sample — dulu auto-attach memakainya; kini harus diabaikan.
	sampleRepo := newFakeSampleRepo()
	tmpl := &model.Sample{IsSystemTemplate: true, Name: "Rebana1 Tak", Part: model.PartRebana1}
	tmpl.ID = 7
	sampleRepo.samples[7] = tmpl

	svc := NewSectionService(sectionRepo, songRepo, sampleRepo)

	sec, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: "Awalan"})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	stored := sectionRepo.sections[sec.ID]
	for _, p := range stored.Parts {
		if len(p.SoundSlots) != 0 {
			t.Fatalf("SoundSlot part %s = %d, want 0 — grid harus mulai kosong", p.Part, len(p.SoundSlots))
		}
	}
}

func TestSectionCreate_TemplateSongForbidden(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	_, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: "Awalan"})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SONG-08)", err)
	}
}

func TestSectionUpdate_BpmOverrideTriState(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	sec, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: "Dasar"})
	if err != nil {
		t.Fatal(err)
	}

	// set nilai
	val := int16(70)
	updated, err := svc.Update(5, sec.ID, dto.UpdateSectionRequest{BpmOverride: &dto.NullableInt16{Set: true, Value: &val}})
	if err != nil {
		t.Fatal(err)
	}
	if updated.BpmOverride == nil || *updated.BpmOverride != 70 {
		t.Fatalf("bpm_override = %v, want 70", updated.BpmOverride)
	}

	// set null (kembali ikut BPM Song)
	cleared, err := svc.Update(5, sec.ID, dto.UpdateSectionRequest{BpmOverride: &dto.NullableInt16{Set: true, Value: nil}})
	if err != nil {
		t.Fatal(err)
	}
	if cleared.BpmOverride != nil {
		t.Fatalf("bpm_override = %v, want nil (FR-SEC-09)", cleared.BpmOverride)
	}

	// tidak dikirim → tidak berubah (masih nil)
	unchanged, err := svc.Update(5, sec.ID, dto.UpdateSectionRequest{Name: strptr("Dasar Baru")})
	if err != nil {
		t.Fatal(err)
	}
	if unchanged.BpmOverride != nil {
		t.Fatalf("bpm_override = %v, want tetap nil", unchanged.BpmOverride)
	}
}

func TestSectionUpdate_BpmOverrideOutOfRange(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	sec, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: "Dasar"})
	if err != nil {
		t.Fatal(err)
	}
	val := int16(500)
	_, err = svc.Update(5, sec.ID, dto.UpdateSectionRequest{BpmOverride: &dto.NullableInt16{Set: true, Value: &val}})
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("err = %v, want ErrBadRequest", err)
	}
}

func TestSectionReorder_NormalizesOrder(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	var ids []uint
	for _, name := range []string{"A", "B", "C"} {
		sec, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: name})
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, sec.ID)
	}

	// pindahkan C (ids[2]) ke posisi 0
	res, err := svc.Reorder(5, ids[2], 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 3 {
		t.Fatalf("len = %d, want 3", len(res))
	}
	if res[0].ID != ids[2] || res[1].ID != ids[0] || res[2].ID != ids[1] {
		t.Fatalf("urutan salah: %+v", res)
	}
	for i, s := range res {
		if s.OrderIndex != i {
			t.Fatalf("order_index[%d] = %d, want %d", i, s.OrderIndex, i)
		}
	}
}

func TestSectionDuplicate_CopiesPartsAndSlots(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	sampleID := uint(9)
	sec, err := svc.Create(5, 1, dto.CreateSectionRequest{Name: "Naik"})
	if err != nil {
		t.Fatal(err)
	}
	stored := sectionRepo.sections[sec.ID]
	steps := "T,D"
	stored.Parts[0].Steps = &steps
	stored.Parts[0].SoundSlots = []model.SoundSlot{{Label: "Tak", Key: "T", SampleID: &sampleID, OrderIndex: 0}}
	sectionRepo.Save(stored)

	copied, err := svc.Duplicate(5, sec.ID)
	if err != nil {
		t.Fatal(err)
	}
	created := sectionRepo.sections[copied.ID]
	if len(created.Parts) != 5 {
		t.Fatalf("jumlah parts hasil duplikasi = %d, want 5", len(created.Parts))
	}
	part0 := created.Parts[0]
	if part0.Steps == nil || *part0.Steps != "T,D" {
		t.Fatal("steps tidak ikut terduplikasi")
	}
	if len(part0.SoundSlots) != 1 || part0.SoundSlots[0].SampleID == nil || *part0.SoundSlots[0].SampleID != sampleID {
		t.Fatal("SoundSlot/sample tidak ikut terduplikasi")
	}
}

func TestSectionDelete_TemplateSongForbidden(t *testing.T) {
	songRepo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	sectionRepo := newFakeSectionRepo()
	svc := NewSectionService(sectionRepo, songRepo, newFakeSampleRepo())

	// simulasi section milik song template (dibuat langsung di fake)
	sec := &model.Section{SongID: 1, Name: "Awalan"}
	sectionRepo.assignIDs(sec)
	sectionRepo.sections[sec.ID] = sec

	err := svc.Delete(5, sec.ID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
}

func strptr(s string) *string { return &s }
