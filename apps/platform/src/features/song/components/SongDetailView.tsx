import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../../components/molecules/PageHeader';
import { EmptyState } from '../../../components/molecules/EmptyState';
import { SectionStrip, type SectionItem } from '../../section/components/SectionStrip';
import { SectionDetailPanel } from '../../section/components/SectionDetailPanel';
import { SongSummaryPanel } from '../../section/components/SongSummaryPanel';

export interface SongDetailData {
  id: number;
  name: string;
  bpm: number;
  is_system_template: boolean;
  sections?: SectionItem[];
}

interface SongDetailViewProps {
  song: SongDetailData;
  /** Breadcrumb / tautan kembali di atas judul. */
  back: ReactNode;
  /** Banner di atas judul (mis. banner Guest read-only). */
  banner?: ReactNode;
  /** Mode lihat-saja (Guest atau Song Template System). */
  readOnly: boolean;
  /** Dipanggil saat aksi edit dicoba dalam mode lihat-saja (AC-12). */
  onEditAttempt: () => void;
  /** Dipanggil setelah mutasi section (create/update/reorder/delete/duplicate). */
  onChanged: () => void;
}

/**
 * Layar 2 wireframe — Detail Song / Manajemen Section: strip chip section,
 * panel "Section Terpilih" (sequencer/duplikasi/hapus/BPM override) dan panel
 * "Ringkasan Song" (pintu Launcher).
 */
export function SongDetailView({ song, back, banner, readOnly, onEditAttempt, onChanged }: SongDetailViewProps) {
  const sorted = (song.sections ?? []).slice().sort((a, b) => a.order_index - b.order_index);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = sorted.find((s) => s.id === selectedId) ?? sorted[0];

  return (
    <div>
      {banner}

      <PageHeader
        back={back}
        title={song.name}
        subtitle={`BPM dasar ${song.bpm} · susun Section secara dinamis — urutan bebas, tempo bisa berbeda tiap Section`}
      />

      <p className="mt-4 rounded-md border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600">
        <span className="font-semibold text-stone-800">Section bersifat dinamis</span> — nama & jumlah
        bebas ditentukan olehmu. Saat Section dibuat, sistem otomatis membuat 5 SectionPart kosong
        (rebana1–4, bass) di baliknya — tidak terlihat di layar ini, baru tampak saat masuk Sequencer
        Mode. Tempo (BPM) tiap Section bersifat opsional — kosong berarti ikut BPM dasar Song.
      </p>

      <SectionStrip
        songId={song.id}
        songBpm={song.bpm}
        sections={sorted}
        selectedId={selected?.id ?? null}
        onSelect={(sec) => setSelectedId(sec.id)}
        onChanged={onChanged}
        readOnly={readOnly}
        onEditAttempt={onEditAttempt}
      />

      {sorted.length > 0 && (
        <p className="mt-1 text-xs text-stone-400">
          ★ = Section ini punya BPM override, berbeda dari BPM dasar Song ({song.bpm})
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {selected ? (
          <SectionDetailPanel
            key={selected.id}
            songId={song.id}
            songBpm={song.bpm}
            section={selected}
            onChanged={onChanged}
            readOnly={readOnly}
            onEditAttempt={onEditAttempt}
          />
        ) : (
          <EmptyState
            icon="♪"
            title="Belum ada Section"
            description="Tambahkan section pertamamu lewat chip “+ Tambah Section” di atas."
          />
        )}
        <SongSummaryPanel songId={song.id} sections={sorted} />
      </div>
    </div>
  );
}
