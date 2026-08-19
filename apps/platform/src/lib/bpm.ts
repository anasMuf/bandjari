/**
 * Skala BPM efektif suatu section terhadap BPM dasar Song.
 *
 * Kontrol BPM temporary di Launcher mengubah BPM dasar Song secara proporsional
 * (rasio temp/base): section dengan BPM override (★) ikut terskala sehingga
 * rasio antar-section tetap terjaga.
 *
 * Rumus: efektif = (override ?? baseBpm) × (tempBpm / baseBpm)
 */
export function scaleBpm(
  override: number | null,
  baseBpm: number,
  tempBpm: number | null,
): number {
  const base = override ?? baseBpm;
  if (tempBpm == null || baseBpm <= 0) return base;
  return (base * tempBpm) / baseBpm;
}
