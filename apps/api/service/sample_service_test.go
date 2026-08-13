package service

import (
	"api/model"
	"api/repository"
	"api/utility"
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"gorm.io/gorm"
)

type fakeSampleRepo struct {
	samples map[uint]*model.Sample
	nextID  uint
	refs    map[uint]int64 // sampleID -> jumlah referensi SoundSlot
}

func newFakeSampleRepo() *fakeSampleRepo {
	return &fakeSampleRepo{samples: map[uint]*model.Sample{}, nextID: 1, refs: map[uint]int64{}}
}

func (f *fakeSampleRepo) Create(sample *model.Sample) error {
	sample.ID = f.nextID
	f.nextID++
	f.samples[sample.ID] = sample
	return nil
}

func (f *fakeSampleRepo) FindByID(id uint) (*model.Sample, error) {
	if s, ok := f.samples[id]; ok {
		return s, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeSampleRepo) ListByUserID(userID uint, part *model.Part) ([]model.Sample, error) {
	var res []model.Sample
	for _, s := range f.samples {
		if s.UserID != nil && *s.UserID == userID && !s.IsSystemTemplate {
			if part == nil || s.Part == *part {
				res = append(res, *s)
			}
		}
	}
	return res, nil
}

// FindTemplateByPartAndLabel mencari template pertama yang namanya mengandung label (case-insensitive).
func (f *fakeSampleRepo) FindTemplateByPartAndLabel(part model.Part, label string) (*model.Sample, error) {
	lower := func(s string) string {
		var b []byte
		for i := 0; i < len(s); i++ {
			c := s[i]
			if c >= 'A' && c <= 'Z' {
				c += 32
			}
			b = append(b, c)
		}
		return string(b)
	}
	for _, s := range f.samples {
		if s.IsSystemTemplate && s.Part == part && containsFold(s.Name, label, lower) {
			return s, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func containsFold(haystack, needle string, lower func(string) string) bool {
	if needle == "" {
		return false
	}
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if lower(haystack[i:i+len(needle)]) == lower(needle) {
			return true
		}
	}
	return false
}

func (f *fakeSampleRepo) CountReferencedBySoundSlots(sampleID uint) (int64, error) {
	return f.refs[sampleID], nil
}

func (f *fakeSampleRepo) Save(sample *model.Sample) error {
	f.samples[sample.ID] = sample
	return nil
}

func (f *fakeSampleRepo) Delete(id uint) error {
	if _, ok := f.samples[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(f.samples, id)
	return nil
}

type fakeStorage struct {
	uploaded map[string][]byte
	urls     map[string]string
	deleted  []string
}

func newFakeStorage() *fakeStorage {
	return &fakeStorage{uploaded: map[string][]byte{}, urls: map[string]string{}}
}

func (f *fakeStorage) Upload(ctx context.Context, key string, data io.Reader, size int64, contentType string) error {
	b, _ := io.ReadAll(data)
	f.uploaded[key] = b
	return nil
}

func (f *fakeStorage) GenerateSignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	return "https://signed.example/" + key, nil
}

func (f *fakeStorage) Delete(ctx context.Context, key string) error {
	f.deleted = append(f.deleted, key)
	return nil
}

var _ repository.SampleRepository = (*fakeSampleRepo)(nil)

func wavBytes() []byte {
	// header RIFF/WAVE minimal — cukup untuk deteksi mimetype audio/wav
	return append([]byte("RIFF\x24\x00\x00\x00WAVE"), bytes.Repeat([]byte{0}, 32)...)
}

func TestSampleUpload_ValidWav(t *testing.T) {
	repo := newFakeSampleRepo()
	storage := newFakeStorage()
	svc := NewSampleService(repo, storage)

	res, err := svc.Upload(5, model.PartRebana1, "Tak Keras", wavBytes())
	if err != nil {
		t.Fatalf("Upload() error = %v", err)
	}
	if res.UserID == nil || *res.UserID != 5 || res.IsSystemTemplate {
		t.Fatal("Sample harus milik user, bukan template")
	}
	if len(storage.uploaded) != 1 {
		t.Fatal("file harus ter-upload ke storage")
	}
}

func TestSampleUpload_RejectsNonWav(t *testing.T) {
	repo := newFakeSampleRepo()
	svc := NewSampleService(repo, newFakeStorage())

	_, err := svc.Upload(5, model.PartRebana1, "Bukan WAV", []byte("ID3 not-a-wav-data"))
	if !errors.Is(err, utility.ErrUnsupportedFormat) {
		t.Fatalf("err = %v, want ErrUnsupportedFormat (FR-SAMP-06)", err)
	}
}

func TestSampleUpload_RejectsTooLarge(t *testing.T) {
	repo := newFakeSampleRepo()
	svc := NewSampleService(repo, newFakeStorage())

	big := wavBytes()
	big = append(big, bytes.Repeat([]byte{0}, utility.MaxSampleSizeBytes)...)
	_, err := svc.Upload(5, model.PartRebana1, "Gede", big)
	if !errors.Is(err, utility.ErrFileTooLarge) {
		t.Fatalf("err = %v, want ErrFileTooLarge (FR-SAMP-06)", err)
	}
}

func TestSampleUpload_RejectsInvalidPart(t *testing.T) {
	repo := newFakeSampleRepo()
	svc := NewSampleService(repo, newFakeStorage())

	_, err := svc.Upload(5, model.Part("dumbuk"), "X", wavBytes())
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("err = %v, want ErrBadRequest (FR-SAMP-02)", err)
	}
}

func TestSampleDelete_ReferencedGetsConflict(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{UserID: uptr(5), Name: "Dipake", Part: model.PartRebana1, ObjectKey: "k"}
	repo.nextID = 2
	repo.refs[1] = 2 // direferensikan 2 SoundSlot
	svc := NewSampleService(repo, newFakeStorage())

	err := svc.Delete(5, 1)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("err = %v, want ErrConflict (FR-SAMP-08)", err)
	}
}

func TestSampleDelete_Success(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{UserID: uptr(5), Name: "Bebas", Part: model.PartRebana1, ObjectKey: "k"}
	repo.nextID = 2
	storage := newFakeStorage()
	svc := NewSampleService(repo, storage)

	if err := svc.Delete(5, 1); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if _, ok := repo.samples[1]; ok {
		t.Fatal("sample harus terhapus")
	}
	if len(storage.deleted) != 1 {
		t.Fatal("object storage harus ikut dihapus")
	}
}

func TestSampleDelete_TemplateForbidden(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{IsSystemTemplate: true, Name: "Bawaan", Part: model.PartRebana1}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	err := svc.Delete(5, 1)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SAMP-12)", err)
	}
}

func TestSampleRename_TemplateForbidden(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{IsSystemTemplate: true, Name: "Bawaan", Part: model.PartRebana1}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	_, err := svc.Rename(5, 1, "Baru")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SAMP-12)", err)
	}
}

func TestSamplePlaybackURL_TemplateAccessibleToGuest(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{IsSystemTemplate: true, Name: "Bawaan", Part: model.PartRebana1, ObjectKey: "samples/system/1.wav"}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	url, err := svc.PlaybackURL(nil, 1)
	if err != nil {
		t.Fatalf("Guest seharusnya bisa putar Sample Template (FR-SAMP-13), err = %v", err)
	}
	if url == "" {
		t.Fatal("URL kosong")
	}
}

func TestSamplePlaybackURL_UserSampleOwnerOnly(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{UserID: uptr(5), Name: "Milik", Part: model.PartRebana1, ObjectKey: "samples/5/1.wav"}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	if _, err := svc.PlaybackURL(uptr(5), 1); err != nil {
		t.Fatalf("pemilik seharusnya bisa akses, err = %v", err)
	}
	if _, err := svc.PlaybackURL(uptr(99), 1); !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (NFR-04)", err)
	}
	if _, err := svc.PlaybackURL(nil, 1); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest err = %v, want ErrForbidden (NFR-04)", err)
	}
}

func TestSampleList_FilterByPart(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{UserID: uptr(5), Name: "A", Part: model.PartRebana1}
	repo.samples[2] = &model.Sample{UserID: uptr(5), Name: "B", Part: model.PartBass}
	repo.nextID = 3
	svc := NewSampleService(repo, newFakeStorage())

	bass := model.PartBass
	res, err := svc.List(5, &bass)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 1 || res[0].Name != "B" {
		t.Fatalf("filter part salah: %+v", res)
	}
}
