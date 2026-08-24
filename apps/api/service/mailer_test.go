package service

import (
	"bytes"
	"strings"
	"testing"
)

// TestMailer_MessageMultipart — bukti bahwa pesan yang dikirim berisi part
// text/html (bukan hanya plain text): email client menampilkan HTML.
func TestMailer_MessageContainsHTMLAndText(t *testing.T) {
	msg, err := buildMessage("no-reply@bandjari.net", "a@mail.com", "Subjek Test", "<p>Body <b>HTML</b></p>", "Body teks polos")
	if err != nil {
		t.Fatalf("buildMessage() error = %v", err)
	}

	var buf bytes.Buffer
	if _, err := msg.WriteTo(&buf); err != nil {
		t.Fatalf("WriteTo() error = %v", err)
	}
	mime := buf.String()

	for _, want := range []string{"multipart/alternative", "text/plain", "text/html", "<p>Body <b>HTML</b></p>", "Body teks polos"} {
		if !strings.Contains(mime, want) {
			t.Fatalf("MIME harus memuat %q — output:\n%s", want, mime)
		}
	}

	// HTML harus muncul SETELAH plain text (preferensi tertinggi di
	// multipart/alternative).
	textIdx := strings.Index(mime, "text/plain")
	htmlIdx := strings.Index(mime, "text/html")
	if textIdx == -1 || htmlIdx == -1 || htmlIdx < textIdx {
		t.Fatalf("urutan part salah: text/plain harus sebelum text/html — output:\n%s", mime)
	}
}
