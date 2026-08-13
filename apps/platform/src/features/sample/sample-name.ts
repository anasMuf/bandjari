/**
 * Nama sample diambil dari nama file tanpa ekstensi (keputusan pemilik produk):
 * "WEDOK TEK.wav" → "WEDOK TEK". Bila nama kosong setelah dipangkas, kembalikan
 * nama file apa adanya agar tetap ada identitas.
 */
export function sampleNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(wav|WAV)$/, '').trim();
  return base || fileName;
}
