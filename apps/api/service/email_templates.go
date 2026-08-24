package service

import (
	"fmt"
	"html"
)

// emailShell — kerangka email HTML dengan branding BandJari. Semua style
// inline (bukan <style>) agar kompatibel dengan email client lama (Gmail,
// Outlook). `%%` dipakai karena di-format via fmt.Sprintf.
func emailShell(title, messageHTML, ctaText, ctaLink, note string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f766e;padding:24px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">BandJari</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#134e4a;">%s</h1>
              %s
              <p style="margin:24px 0 0;text-align:center;">
                <a href="%s" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">%s</a>
              </p>
              <p style="margin:28px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">%s</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f4f5;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">BandJari — penyusun &amp; pemutar pola pukulan rebana Al-Banjari</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, html.EscapeString(title), html.EscapeString(title), messageHTML, ctaLink, ctaText, note)
}

// verificationEmail — email verifikasi (HTML + plain text). Mengembalikan
// keduanya untuk multipart/alternative.
func verificationEmail(name, code string) (htmlBody, textBody string) {
	link := appBaseURL() + "/verify?code=" + code
	message := fmt.Sprintf(`<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Halo <strong>%s</strong>,</p>
<p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">Terima kasih sudah mendaftar di BandJari! Klik tombol di bawah untuk memverifikasi alamat email Anda.</p>`, html.EscapeString(name))
	note := "Link berlaku 24 jam. Bila Anda tidak mendaftar di BandJari, abaikan email ini."

	htmlBody = emailShell("Verifikasi email BandJari", message, "Verifikasi Email", link, note)
	textBody = "Halo " + name + ",\n\n" +
		"Terima kasih sudah mendaftar di BandJari. Verifikasi alamat email Anda dengan membuka link berikut:\n" +
		link + "\n\n" +
		"Link berlaku 24 jam. Bila Anda tidak mendaftar di BandJari, abaikan email ini."
	return htmlBody, textBody
}

// resetEmail — email reset password (HTML + plain text).
func resetEmail(name, code string) (htmlBody, textBody string) {
	link := appBaseURL() + "/reset-password?code=" + code
	message := fmt.Sprintf(`<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Halo <strong>%s</strong>,</p>
<p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">Kami menerima permintaan reset password untuk akun BandJari Anda. Klik tombol di bawah untuk memilih password baru.</p>`, html.EscapeString(name))
	note := "Link berlaku 1 jam. Bila Anda tidak meminta reset password, abaikan email ini — password Anda tidak berubah."

	htmlBody = emailShell("Reset password BandJari", message, "Atur Password Baru", link, note)
	textBody = "Halo " + name + ",\n\n" +
		"Kami menerima permintaan reset password untuk akun BandJari Anda. Buka link berikut untuk memilih password baru:\n" +
		link + "\n\n" +
		"Link berlaku 1 jam. Bila Anda tidak meminta reset password, abaikan email ini."
	return htmlBody, textBody
}
