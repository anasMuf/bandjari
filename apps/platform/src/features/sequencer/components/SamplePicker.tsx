import { useGetSamples, useGetSamplesTemplates } from '../../../api/endpoints/samples/samples';
import type { DtoSuccessResponse } from '../../../api/model';
import { useAuth } from '../../auth/AuthContext';

interface SampleOption {
  id: number;
  name: string;
  is_system_template?: boolean;
}

interface SamplePickerProps {
  id?: string;
  label: string;
  value: number | null;
  onChange: (sampleId: number | null) => void;
}

/**
 * Dropdown pemilihan Sample untuk satu SoundSlot, menampilkan dua kelompok
 * terpisah (FR-SAMP-14): "Bawaan (Template System)" read-only dan "Sample Saya"
 * (milik user), plus opsi mengosongkan.
 */
export function SamplePicker({ id, label, value, onChange }: SamplePickerProps) {
  const { isAuthenticated } = useAuth();
  // Guest tidak punya akses ke daftar sample milik user — query dimatikan agar
  // tidak memicu 401 saat menjelajah Sequencer template dalam mode lihat-saja.
  const mineQuery = useGetSamples(undefined, { query: { enabled: isAuthenticated } });
  const templatesQuery = useGetSamplesTemplates();
  const mine = ((mineQuery.data?.data as DtoSuccessResponse | undefined)?.data ?? []) as SampleOption[];
  const templates = ((templatesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as SampleOption[];

  const loading = templatesQuery.isLoading || (isAuthenticated && mineQuery.isLoading);

  return (
    <div>
      <label htmlFor={id} className="block text-sm/6 font-medium text-stone-900">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-sm text-stone-900 ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-brand-700"
      >
        <optgroup label="Bawaan (Template System)">
          {loading ? (
            <option disabled>Memuat...</option>
          ) : (
            templates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Bawaan)
              </option>
            ))
          )}
        </optgroup>
        <optgroup label="Sample Saya">
          {loading ? (
            <option disabled>Memuat...</option>
          ) : !isAuthenticated ? (
            <option disabled>— login untuk melihat sample milikmu —</option>
          ) : mine.length === 0 ? (
            <option disabled>(belum ada sample milikmu)</option>
          ) : (
            mine.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </optgroup>
        <option value="">— kosongkan —</option>
      </select>
    </div>
  );
}
