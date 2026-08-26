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
	// publicRefs: sampleID -> dipakai lagu public/template (FR-VIS)
	publicRefs map[uint]bool
}

func newFakeSampleRepo() *fakeSampleRepo {
	return &fakeSampleRepo{samples: map[uint]*model.Sample{}, nextID: 1, refs: map[uint]int64{}, publicRefs: map[uint]bool{}}
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
	for _, s := range f.samples {
		if s.IsSystemTemplate && s.Part == part && containsFold(s.Name, label, lowerASCII) {
			return s, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeSampleRepo) FindTemplateByNameAndPart(name string, part model.Part) (*model.Sample, error) {
	for _, s := range f.samples {
		if s.IsSystemTemplate && s.Name == name && s.Part == part {
			return s, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeSampleRepo) ListTemplates(part *model.Part) ([]model.Sample, error) {
	var res []model.Sample
	for _, s := range f.samples {
		if s.IsSystemTemplate && (part == nil || s.Part == *part) {
			res = append(res, *s)
		}
	}
	return res, nil
}

func lowerASCII(s string) string {
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

func (f *fakeSampleRepo) CountSoundSlotsBySampleIDs(sampleIDs []uint) (map[uint]int64, error) {
	res := make(map[uint]int64, len(sampleIDs))
	for _, id := range sampleIDs {
		res[id] = f.refs[id]
	}
	return res, nil
}

func (f *fakeSampleRepo) IsReferencedByPublicSong(sampleID uint) (bool, error) {
	return f.publicRefs[sampleID], nil
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

	res, err := svc.Upload(5, false, false, model.PartRebana1, "Tak Keras", wavBytes())
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

// failingSampleRepo memaksa Create gagal — untuk menguji compensating cleanup:
// object yang sudah ter-upload harus dihapus dari storage saat insert DB gagal.
type failingSampleRepo struct {
	*fakeSampleRepo
}

func (f *failingSampleRepo) Create(sample *model.Sample) error {
	return errors.New("db down")
}

func TestSampleUpload_DBInsertFailureCleansUpStorage(t *testing.T) {
	repo := &failingSampleRepo{fakeSampleRepo: newFakeSampleRepo()}
	storage := newFakeStorage()
	svc := NewSampleService(repo, storage)

	_, err := svc.Upload(5, false, false, model.PartRebana1, "Tak Keras", wavBytes())
	if err == nil {
		t.Fatal("Upload() harus gagal saat insert DB gagal")
	}
	if len(storage.uploaded) != 1 {
		t.Fatalf("file harus sempat ter-upload, got %d", len(storage.uploaded))
	}
	if len(storage.deleted) != 1 {
		t.Fatalf("object harus dibersihkan dari storage, deleted = %v", storage.deleted)
	}
}

func TestSampleUpload_RejectsNonWav(t *testing.T) {
	repo := newFakeSampleRepo()
	svc := NewSampleService(repo, newFakeStorage())

	_, err := svc.Upload(5, false, false, model.PartRebana1, "Bukan WAV", []byte("ID3 not-a-wav-data"))
	if !errors.Is(err, utility.ErrUnsupportedFormat) {
		t.Fatalf("err = %v, want ErrUnsupportedFormat (FR-SAMP-06)", err)
	}
}

func TestSampleUpload_RejectsTooLarge(t *testing.T) {
	repo := newFakeSampleRepo()
	svc := NewSampleService(repo, newFakeStorage())

	big := wavBytes()
	big = append(big, bytes.Repeat([]byte{0}, utility.MaxSampleSizeBytes)...)
	_, err := svc.Upload(5, false, false, model.PartRebana1, "Gede", big)
	if !errors.Is(err, utility.ErrFileTooLarge) {
		t.Fatalf("err = %v, want ErrFileTooLarge (FR-SAMP-06)", err)
	}
}

func TestSampleUpload_RejectsInvalidPart(t *testing.T) {
	repo := newFakeSampleRepo()
	svc := NewSampleService(repo, newFakeStorage())

	_, err := svc.Upload(5, false, false, model.Part("dumbuk"), "X", wavBytes())
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

	err := svc.Delete(5, false, 1)
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

	if err := svc.Delete(5, false, 1); err != nil {
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

	err := svc.Delete(5, false, 1)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SAMP-12)", err)
	}
}

func TestSampleRename_TemplateForbidden(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{IsSystemTemplate: true, Name: "Bawaan", Part: model.PartRebana1}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	_, err := svc.Rename(5, false, 1, "Baru")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-SAMP-12)", err)
	}
}

// TestSampleRole_AdminManagesTemplate — admin boleh rename/hapus/upload Sample
// Template System; user biasa tetap ditolak (FR-ROLE).
func TestSampleRole_AdminManagesTemplate(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{IsSystemTemplate: true, Name: "Bawaan", Part: model.PartRebana1, ObjectKey: "k"}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	// admin rename template
	renamed, err := svc.Rename(5, true, 1, "Bawaan Baru")
	if err != nil {
		t.Fatalf("admin Rename() error = %v", err)
	}
	if renamed.Name != "Bawaan Baru" {
		t.Fatalf("nama = %q, want Bawaan Baru", renamed.Name)
	}

	// admin upload template sample
	uploaded, err := svc.Upload(5, true, true, model.PartRebana1, "Tpl Baru", wavBytes())
	if err != nil {
		t.Fatalf("admin Upload template error = %v", err)
	}
	if !uploaded.IsSystemTemplate || uploaded.UserID != nil {
		t.Fatalf("harus template tanpa pemilik: %+v", uploaded)
	}

	// admin hapus template
	if err := svc.Delete(5, true, 1); err != nil {
		t.Fatalf("admin Delete() error = %v", err)
	}
}

// TestSampleRole_UserCannotUploadTemplate — user biasa dilarang upload template.
func TestSampleRole_UserCannotUploadTemplate(t *testing.T) {
	svc := NewSampleService(newFakeSampleRepo(), newFakeStorage())

	_, err := svc.Upload(5, false, true, model.PartRebana1, "X", wavBytes())
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden (FR-ROLE)", err)
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

// TestSamplePlaybackURL_PublicSongReference — sample milik user yang dipakai
// lagu public ikut bisa diputar Guest (FR-VIS): lagu public harus benar-benar
// bisa dimainkan tanpa login.
func TestSamplePlaybackURL_PublicSongReferenceAccessibleToGuest(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{UserID: uptr(5), Name: "Dipake Lagu Public", Part: model.PartRebana1, ObjectKey: "samples/5/1.wav"}
	repo.nextID = 2
	repo.publicRefs[1] = true
	svc := NewSampleService(repo, newFakeStorage())

	url, err := svc.PlaybackURL(nil, 1)
	if err != nil {
		t.Fatalf("Guest seharusnya bisa putar sample yang dipakai lagu public, err = %v (FR-VIS)", err)
	}
	if url == "" {
		t.Fatal("URL kosong")
	}
}

// TestSamplePlaybackURL_PrivateSampleStillForbidden — sample yang tidak dipakai
// lagu public/template tetap hanya pemiliknya (tidak ada pelebaran akses).
func TestSamplePlaybackURL_PrivateSampleStillForbidden(t *testing.T) {
	repo := newFakeSampleRepo()
	repo.samples[1] = &model.Sample{UserID: uptr(5), Name: "Pribadi", Part: model.PartRebana1, ObjectKey: "samples/5/1.wav"}
	repo.nextID = 2
	svc := NewSampleService(repo, newFakeStorage())

	if _, err := svc.PlaybackURL(nil, 1); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest err = %v, want ErrForbidden", err)
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
