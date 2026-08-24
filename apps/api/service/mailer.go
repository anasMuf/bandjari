package service

import (
	"log"
	"os"
	"strconv"

	"github.com/wneessen/go-mail"
)

// Mailer — pengirim email. Implementasi nyata SMTP; fallback console untuk dev
// (E-AUTH-2026 R14). htmlBody & textBody dikirim sebagai multipart/alternative
// (email client lama yang tidak mendukung HTML tetap mendapat plain text).
type Mailer interface {
	Send(toEmail, subject, htmlBody, textBody string) error
}

// consoleMailer mencetak email ke log — dipakai saat SMTP belum dikonfigurasi
// (dev) agar alur verifikasi/reset tetap bisa diuji tanpa server email.
// Mencetak plain text (ringkas & mudah dibaca di log).
type consoleMailer struct{}

func (consoleMailer) Send(toEmail, subject, htmlBody, textBody string) error {
	log.Printf("📧 [MAIL dev-mode] to=%s subject=%q\n%s", toEmail, subject, textBody)
	return nil
}

// smtpMailer mengirim via SMTP (STARTTLS, port 587) memakai wneessen/go-mail.
type smtpMailer struct {
	host     string
	port     int
	username string
	password string
	from     string
}

// buildMessage — membangun pesan multipart/alternative (text/plain + text/html).
// Urutan [text, html] → HTML dianggap preferensi tertinggi oleh email client
// (RFC 2046: bagian terakhir = paling disukai).
func buildMessage(from, to, subject, htmlBody, textBody string) (*mail.Msg, error) {
	msg := mail.NewMsg()
	if err := msg.From(from); err != nil {
		return nil, err
	}
	if err := msg.To(to); err != nil {
		return nil, err
	}
	msg.Subject(subject)
	msg.SetBodyString(mail.TypeTextPlain, textBody)
	msg.AddAlternativeString(mail.TypeTextHTML, htmlBody)
	return msg, nil
}

func (m smtpMailer) Send(toEmail, subject, htmlBody, textBody string) error {
	msg, err := buildMessage(m.from, toEmail, subject, htmlBody, textBody)
	if err != nil {
		return err
	}

	client, err := mail.NewClient(
		m.host,
		mail.WithPort(m.port),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(m.username),
		mail.WithPassword(m.password),
		mail.WithTLSPolicy(mail.TLSMandatory),
	)
	if err != nil {
		return err
	}
	defer client.Close()
	return client.DialAndSend(msg)
}

// NewMailer membaca env SMTP_*. Bila SMTP_HOST kosong → consoleMailer (dev).
func NewMailer() Mailer {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		return consoleMailer{}
	}
	port := 587
	if raw := os.Getenv("SMTP_PORT"); raw != "" {
		if p, err := strconv.Atoi(raw); err == nil && p > 0 {
			port = p
		}
	}
	return smtpMailer{
		host:     host,
		port:     port,
		username: os.Getenv("SMTP_USERNAME"),
		password: os.Getenv("SMTP_PASSWORD"),
		from:     os.Getenv("SMTP_FROM_EMAIL"),
	}
}
