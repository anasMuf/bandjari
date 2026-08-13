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

func (f *fakeSongRepo) Save(song *model.Song) error {
	f.songs[song.ID] = song
	return nil
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

	_, err := svc.Update(5, 1, dto.UpdateSongRequest{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SONG-08)", err)
	}
}

func TestSongUpdate_NotOwnerForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{UserID: uptr(5), Name: "Lagu", Bpm: 90})
	svc := NewSongService(repo)

	_, err := svc.Update(99, 1, dto.UpdateSongRequest{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-AUTH-02)", err)
	}
}

func TestSongDelete_SystemTemplateForbidden(t *testing.T) {
	repo := newFakeSongRepo(&model.Song{IsSystemTemplate: true, Name: "Template", Bpm: 90})
	svc := NewSongService(repo)

	if err := svc.Delete(5, 1); !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SONG-08)", err)
	}
}

func TestSongDuplicate_DeepCopy(t *testing.T) {
	sampleID := uint(77)
	steps := "TDTD"
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
