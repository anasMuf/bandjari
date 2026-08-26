package service

import (
	"api/dto"
	"api/model"
	"api/repository"
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

func (f *fakeSongRepo) ListPublic() ([]model.Song, error) {
	var res []model.Song
	for _, s := range f.songs {
		if !s.IsSystemTemplate && s.Visibility == string(model.VisibilityPublic) {
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

// Tiga metode berikut meniru cascade soft-delete GORM: anak-anak dihapus dari
// struktur (efek setara mengisi deleted_at pada seluruh turunan).
func (f *fakeSongRepo) DeleteSectionsBySongID(songID uint) error {
	if s, ok := f.songs[songID]; ok {
		s.Sections = nil
	}
	return nil
}

func (f *fakeSongRepo) DeletePartsBySongID(songID uint) error {
	if s, ok := f.songs[songID]; ok {
		for i := range s.Sections {
			s.Sections[i].Parts = nil
		}
	}
	return nil
}

func (f *fakeSongRepo) DeleteSlotsBySongID(songID uint) error {
	if s, ok := f.songs[songID]; ok {
		for i := range s.Sections {
			for j := range s.Sections[i].Parts {
				s.Sections[i].Parts[j].SoundSlots = nil
			}
		}
	}
	return nil
}

func (f *fakeSongRepo) WithTransaction(fn func(repo repository.SongRepository) error) error {
	return fn(f)
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

// TestSongDelete_CascadesToChildren memastikan kebijakan cascade soft-delete:
// Section → SectionPart → SoundSlot anak ikut terhapus saat Song dihapus,
// agar tidak ada baris aktif yatim yang memblokir penghapusan Sample (FR-SAMP-08).
func TestSongDelete_CascadesToChildren(t *testing.T) {
	sampleID := uint(77)
	src := &model.Song{
		UserID: uptr(5),
		Name:   "Lagu",
		Bpm:    90,
		Sections: []model.Section{
			{Name: "Awalan", Parts: []model.SectionPart{
				{Part: model.PartRebana1, SoundSlots: []model.SoundSlot{
					{Label: "Tak", Key: "T", SampleID: &sampleID},
				}},
			}},
		},
	}
	repo := newFakeSongRepo(src)
	svc := NewSongService(repo)

	sec0 := &src.Sections[0]
	part0 := &sec0.Parts[0]

	if err := svc.Delete(5, false, 1); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if _, ok := repo.songs[1]; ok {
		t.Fatal("song harus terhapus")
	}
	if len(src.Sections) != 0 {
		t.Fatalf("Section anak harus ikut terhapus (cascade), tersisa %d", len(src.Sections))
	}
	if len(sec0.Parts) != 0 {
		t.Fatalf("SectionPart anak harus ikut terhapus (cascade), tersisa %d", len(sec0.Parts))
	}
	if len(part0.SoundSlots) != 0 {
		t.Fatalf("SoundSlot anak harus ikut terhapus (cascade), tersisa %d", len(part0.SoundSlots))
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

// --- FR-VIS: visibility saat create ---

func TestSongCreate_DefaultPrivate(t *testing.T) {
	repo := newFakeSongRepo()
	svc := NewSongService(repo)

	created, err := svc.Create(5, false, dto.CreateSongRequest{Name: "Lagu", Bpm: 90})
	if err != nil {
		t.Fatal(err)
	}
	if created.Visibility != string(model.VisibilityPrivate) {
		t.Fatalf("visibility = %q, want private (FR-VIS)", created.Visibility)
	}
}

func TestSongCreate_AdminCanCreatePublic(t *testing.T) {
	repo := newFakeSongRepo()
	svc := NewSongService(repo)
	public := string(model.VisibilityPublic)

	created, err := svc.Create(5, true, dto.CreateSongRequest{Name: "Lagu Publik", Bpm: 90, Visibility: &public})
	if err != nil {
		t.Fatalf("admin buat lagu public error = %v", err)
	}
	if created.Visibility != string(model.VisibilityPublic) {
		t.Fatalf("visibility = %q, want public", created.Visibility)
	}
}

func TestSongCreate_NonAdminCannotCreatePublic(t *testing.T) {
	repo := newFakeSongRepo()
	svc := NewSongService(repo)
	public := string(model.VisibilityPublic)

	_, err := svc.Create(5, false, dto.CreateSongRequest{Name: "Lagu", Bpm: 90, Visibility: &public})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("user biasa tidak boleh publish saat create, err = %v, want ErrForbidden (FR-VIS)", err)
	}
}

// --- FR-VIS: status lagu public/private ---

func TestSongSetVisibility_OwnerAdminCanToggle(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	updated, err := svc.SetVisibility(5, true, 1, string(model.VisibilityPublic))
	if err != nil {
		t.Fatalf("admin pemilik harus bisa set public, err = %v", err)
	}
	if updated.Visibility != string(model.VisibilityPublic) {
		t.Fatalf("visibility = %q, want public", updated.Visibility)
	}
	if repo.songs[1].Visibility != string(model.VisibilityPublic) {
		t.Fatal("visibility harus tersimpan ke repository")
	}

	if _, err := svc.SetVisibility(5, true, 1, string(model.VisibilityPrivate)); err != nil {
		t.Fatalf("admin pemilik harus bisa set private, err = %v", err)
	}
}

func TestSongSetVisibility_RegularUserForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.SetVisibility(5, false, 1, string(model.VisibilityPublic))
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("user biasa tidak boleh set visibility, err = %v, want ErrForbidden (FR-VIS)", err)
	}
}

func TestSongSetVisibility_AdminNotOwnerForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.SetVisibility(99, true, 1, string(model.VisibilityPublic))
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("admin non-pemilik tidak boleh set visibility lagu user lain, err = %v (FR-AUTH-02)", err)
	}
}

func TestSongSetVisibility_TemplateForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.SetVisibility(5, true, 1, string(model.VisibilityPublic))
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("template tak punya pemilik → visibility tak bisa diubah, err = %v", err)
	}
}

func TestSongSetVisibility_NotFound(t *testing.T) {
	repo := newFakeSongRepo()
	svc := NewSongService(repo)

	_, err := svc.SetVisibility(5, true, 1, string(model.VisibilityPublic))
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestSongListPublic_OnlyPublicNonTemplate(t *testing.T) {
	repo := newFakeSongRepo(
		&model.Song{UserID: uptr(1), Name: "Publik", Bpm: 90, Visibility: string(model.VisibilityPublic),
			Author: &model.User{Name: "Admin Satu"}},
		&model.Song{UserID: uptr(1), Name: "Privat", Bpm: 90}, // default private
		&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90},
	)
	svc := NewSongService(repo)

	res, err := svc.ListPublic()
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 1 {
		t.Fatalf("len = %d, want 1 (hanya lagu public non-template)", len(res))
	}
	if res[0].Name != "Publik" || res[0].AuthorName != "Admin Satu" {
		t.Fatalf("res = %+v, want Publik + author Admin Satu", res[0])
	}
}

func TestSongGetByID_PublicSong_AccessibleToGuest(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Publik", Bpm: 90, Visibility: string(model.VisibilityPublic)})
	svc := NewSongService(repo)

	song, err := svc.GetByID(1, nil)
	if err != nil {
		t.Fatalf("Guest seharusnya bisa akses lagu public, err = %v (FR-VIS)", err)
	}
	if song.Name != "Publik" {
		t.Fatal("response tidak sesuai")
	}
}

func TestSongGetByID_PublicSong_AccessibleToAnyUser(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Publik", Bpm: 90, Visibility: string(model.VisibilityPublic)})
	svc := NewSongService(repo)

	if _, err := svc.GetByID(1, uptr(99)); err != nil {
		t.Fatalf("user lain seharusnya bisa akses lagu public, err = %v (FR-VIS)", err)
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
