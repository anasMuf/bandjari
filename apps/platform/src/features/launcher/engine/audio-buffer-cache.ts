// Cache AudioBuffer in-memory per sampleId (scope per sesi halaman) —
// hindari fetch/decode ulang saat Section di-trigger ulang (TDD Bagian 12).
export class AudioBufferCache {
  private buffers = new Map<number, AudioBuffer>();
  private inflight = new Map<number, Promise<AudioBuffer>>();

  constructor(private ctx: AudioContext) {}

  /** Muat (atau ambil dari cache/inflight) buffer untuk satu sample. */
  async load(sampleId: number, url: string): Promise<AudioBuffer> {
    const existing = this.buffers.get(sampleId);
    if (existing) return existing;

    const pending = this.inflight.get(sampleId);
    if (pending) return pending;

    const promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat audio (${r.status})`);
        return r.arrayBuffer();
      })
      .then((arrayBuffer) => this.ctx.decodeAudioData(arrayBuffer))
      .then((buffer) => {
        this.buffers.set(sampleId, buffer);
        return buffer;
      })
      .finally(() => {
        this.inflight.delete(sampleId);
      });
    this.inflight.set(sampleId, promise);
    return promise;
  }

  get(sampleId: number): AudioBuffer | undefined {
    return this.buffers.get(sampleId);
  }
}
