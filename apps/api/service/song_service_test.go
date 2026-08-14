package service

import (
	"api/dto"
	"api/model"
	"errors"
	"testing"

	"gorm.io/gorm"
)

type fakeSongRepo struct {
	songs map[uint]*model.Song
}

func newFakeSongRepo(songs ...*model.Song) *fakeSongRepo {
	m := map[uint]*model.Song{}
	for i, s := range songs {
		id := uint(i + 1)
		s.ID = id
		m[id] = s
	}
	return &fakeSongRepo{songs: m}
}

func (f *fakeSongRepo) Create(song *model.Song) error {
	id := uint(len(f.songs) + 100)
	song.ID = id
	// GORM menugaskan ID Section/SectionPart saat create asosiasi — fake meniru.
	for i := range song.Sections {
		song.Sections[i].ID = id*1000 + uint(i) + 1
		for j := range song.Sections[i].Parts {
			song.Sections[i].Parts[j].ID = song.Sections[i].ID*100 + uint(j) + 1
		}
	}
	f.songs[id] = song
	return nil
}

func (f *fakeSongRepo) FindByID(id uint) (*model.Song, error) {
	if s, ok := f.songs[id]; ok {
		return s, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeSongRepo) FindByIDWithSections(id uint) (*model.Song, error) {
	return f.FindByID(id)
}

func (f *fakeSongRepo) ListByUserID(userID uint) ([]model.Song, error) {
	var res []model.Song
	for _, s := range f.songs {
		if s.UserID != nil && *s.UserID == userID && !s.IsSystemTemplate {
			res = append(res, *s)
		}
	}
	return res, nil
}

func (f *fakeSongRepo) ListTemplates() ([]model.Song, error) {
	var res []model.Song
	for _, s := range f.songs {
		if s.IsSystemTemplate {
			res = append(res, *s)
		}
	}
	return res, nil
}

func (f *fakeSongRepo) Save(song *model.Song) error {
	f.songs[song.ID] = song
	return nil
}

func (f *fakeSongRepo) UpdateSectionNextTarget(sectionID uint, mode string, targetID *uint) error {
	for _, s := range f.songs {
		for i := range s.Sections {
			if s.Sections[i].ID == sectionID {
				s.Sections[i].NextMode = mode
				s.Sections[i].NextSectionID = targetID
				return nil
			}
		}
	}
	return gorm.ErrRecordNotFound
}

func (f *fakeSongRepo) UpdateSectionLoop(sectionID uint, loop bool) error {
	for _, s := range f.songs {
		for i := range s.Sections {
			if s.Sections[i].ID == sectionID {
				s.Sections[i].Loop = loop
				return nil
			}
		}
	}
	return gorm.ErrRecordNotFound
}

func (f *fakeSongRepo) CountSectionsBySongIDs(songIDs []uint) (map[uint]int64, error) {
	res := make(map[uint]int64, len(songIDs))
	for _, id := range songIDs {
		if s, ok := f.songs[id]; ok {
			res[id] = int64(len(s.Sections))
		}
	}
	return res, nil
}

func (f *fakeSongRepo) Delete(id uint) error {
	if _, ok := f.songs[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(f.songs, id)
	return nil
}

func uptr(u uint) *uint { return &u }

func TestSongGetByID_SystemTemplate_AccessibleToGuest(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	song, err := svc.GetByID(1, nil)
	if err != nil {
		t.Fatalf("Guest seharusnya bisa akses Song Template, err = %v", err)
	}
	if !song.IsSystemTemplate {
		t.Fatal("response tidak sesuai")
	}
}

func TestSongGetByID_UserSong_GuestGetsNotFound(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.GetByID(1, nil)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound (FR-AUTH-05)", err)
	}
}

func TestSongGetByID_UserSong_OtherUserGetsForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.GetByID(1, uptr(99))
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-AUTH-02)", err)
	}
}

func TestSongGetByID_UserSong_OwnerOK(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	song, err := svc.GetByID(1, uptr(5))
	if err != nil {
		t.Fatalf("owner seharusnya bisa akses, err = %v", err)
	}
	if song.Name != "Lagu" {
		t.Fatal("response tidak sesuai")
	}
}

func TestSongUpdate_SystemTemplateForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.Update(5, false, 1, dto.UpdateSongRequest{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SONG-08)", err)
	}
}

func TestSongUpdate_NotOwnerForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.Update(99, false, 1, dto.UpdateSongRequest{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-AUTH-02)", err)
	}
}

func TestSongDelete_SystemTemplateForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	if err := svc.Delete(5, false, 1); !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SONG-08)", err)
	}
}

func TestSongDuplicate_DeepCopy(t *testing.T) {
	sampleID := uint(77)
	steps := "T,D,T,D"
	src := &model.Song{
		UserID: uptr(5),
		Name:   "Asli",
		Bpm:    90,
		Sections: []model.Section{
			{
				Name: "Awalan", OrderIndex: 0,
				Parts: []model.SectionPart{
					{
						Part:  model.PartRebana1,
						Steps: &steps,
						SoundSlots: []model.SoundSlot{
							{Label: "Tak", Key: "T", SampleID: &sampleID, OrderIndex: 0},
						},
					},
				},
			},
		},
	}
	repo := newFakeSongRepo(src)
	svc := NewSongService(repo)

	copied, err := svc.Duplicate(5, 1)
	if err != nil {
		t.Fatalf("Duplicate() error = %v", err)
	}
	if copied.IsSystemTemplate {
		t.Fatal("hasil duplikasi tidak boleh is_system_template")
	}
	if copied.UserID == nil || *copied.UserID != 5 {
		t.Fatal("hasil duplikasi harus milik user yang login")
	}

	created := repo.songs[copied.ID]
	if len(created.Sections) != 1 || len(created.Sections[0].Parts) != 1 {
		t.Fatal("Section/SectionPart tidak ikut terduplikasi")
	}
	part := created.Sections[0].Parts[0]
	if len(part.SoundSlots) != 1 {
		t.Fatal("SoundSlot tidak ikut terduplikasi")
	}
	if part.SoundSlots[0].SampleID == nil || *part.SoundSlots[0].SampleID != sampleID {
		t.Fatal("referensi Sample harus dipertahankan (FR-SAMP-04)")
	}
}

func TestSongDuplicate_TemplateByAnyUser(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	copied, err := svc.Duplicate(42, 1)
	if err != nil {
		t.Fatalf("user manapun boleh duplikasi template (FR-SONG-10), err = %v", err)
	}
	if copied.UserID == nil || *copied.UserID != 42 {
		t.Fatal("hasil duplikasi harus milik user")
	}
}

func TestSongDuplicate_OtherUsersSongForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.Duplicate(99, 1)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
}

// TestSongRole_AdminManagesTemplate — admin boleh update & hapus Song Template
// System; user biasa tetap ditolak (FR-ROLE).
func TestSongRole_AdminManagesTemplate(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	if _, err := svc.Update(5, false, 1, dto.UpdateSongRequest{Name: sptr("X")}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("user biasa: err = %v, want ErrForbidden (FR-ROLE)", err)
	}

	updated, err := svc.Update(5, true, 1, dto.UpdateSongRequest{Name: sptr("Template Baru"), Bpm: i16ptr(100)})
	if err != nil {
		t.Fatalf("admin Update() error = %v", err)
	}
	if updated.Name != "Template Baru" || updated.Bpm != 100 {
		t.Fatalf("response salah: %+v", updated)
	}

	if err := svc.Delete(5, true, 1); err != nil {
		t.Fatalf("admin Delete() error = %v", err)
	}
	if _, ok := repo.songs[1]; ok {
		t.Fatal("template harus terhapus oleh admin")
	}
}

// TestSongRole_CreateTemplate — hanya admin boleh membuat Song Template System.
func TestSongRole_CreateTemplate(t *testing.T) {
	repo := newFakeSongRepo()
	svc := NewSongService(repo)
	asTemplate := true

	if _, err := svc.Create(5, false, dto.CreateSongRequest{Name: "T", Bpm: 90, IsSystemTemplate: &asTemplate}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("user biasa buat template: err = %v, want ErrForbidden (FR-ROLE)", err)
	}

	created, err := svc.Create(5, true, dto.CreateSongRequest{Name: "Tpl", Bpm: 90, IsSystemTemplate: &asTemplate})
	if err != nil {
		t.Fatalf("admin Create template error = %v", err)
	}
	if !created.IsSystemTemplate || created.UserID != nil {
		t.Fatalf("harus template tanpa pemilik: %+v", created)
	}
}

func sptr(s string) *string { return &s }

func i16ptr(v int16) *int16 { return &v }

// TestSongDuplicate_RemapsNextTarget memastikan next_section_id ikut di-remap:
// section salinan yang "lanjut ke target tertentu" harus menunjuk salinan
// targetnya di Song baru — bukan section asal.
func TestSongDuplicate_RemapsNextTarget(t *testing.T) {
	src := &model.Song{
		UserID: uptr(5),
		Name:   "Asli",
		Bpm:    90,
		Sections: []model.Section{
			{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 11}}, Name: "Awalan", OrderIndex: 0, Loop: false,
				NextMode: string(model.NextModeTarget), NextSectionID: uptr(12)},
			{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 12}}, Name: "Dasar", OrderIndex: 1, Loop: true, NextMode: string(model.NextModeOrder)},
			{BaseModel: model.BaseModel{PrimaryKey: model.PrimaryKey{ID: 13}}, Name: "Penutup", OrderIndex: 2, Loop: false, NextMode: string(model.NextModeEnd)},
		},
	}
	repo := newFakeSongRepo(src)
	svc := NewSongService(repo)

	copied, err := svc.Duplicate(5, 1)
	if err != nil {
		t.Fatalf("Duplicate() error = %v", err)
	}
	created := repo.songs[copied.ID]
	if len(created.Sections) != 3 {
		t.Fatalf("jumlah section = %d, want 3", len(created.Sections))
	}

	awal := created.Sections[0]
	if awal.NextMode != string(model.NextModeTarget) || awal.NextSectionID == nil {
		t.Fatalf("Awalan salinan harus tetap mode target, got mode=%s id=%v", awal.NextMode, awal.NextSectionID)
	}
	if *awal.NextSectionID == 12 {
		t.Fatal("next_section_id harus di-remap ke ID salinan Dasar, bukan ID asal (12)")
	}
	if *awal.NextSectionID != created.Sections[1].ID {
		t.Fatalf("next_section_id = %d, want ID Dasar salinan %d", *awal.NextSectionID, created.Sections[1].ID)
	}
	if created.Sections[2].NextMode != string(model.NextModeEnd) {
		t.Fatalf("mode Penutup = %s, want end", created.Sections[2].NextMode)
	}
}
