import { useGetSamples } from '../../../api/endpoints/samples/samples';
import type { DtoSuccessResponse } from '../../../api/model';

interface SampleOption {
  id: number;
  name: string;
}

interface SamplePickerProps {
  id?: string;
  label: string;
  value: number | null;
  onChange: (sampleId: number | null) => void;
}

/**
 * Dropdown pemilihan Sample untuk satu SoundSlot, menampilkan dua kelompok
 * terpisah (FR-SAMP-14): "Sample Saya" (dapat dipilih) dan "Sample Bawaan"
 * (optgroup dinonaktifkan sampai seeding template tersedia — Phase 6).
 */
export function SamplePicker({ id, label, value, onChange }: SamplePickerProps) {
  const samplesQuery = useGetSamples();
  const samples = ((samplesQuery.data?.data as DtoSuccessResponse | undefined)?.data ??
    []) as SampleOption[];

  return (
    <div>
      <label htmlFor={id} className="block text-sm/6 font-medium text-gray-900">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-sm text-gray-900 ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600"
      >
        <option value="">Tanpa sample (senyap)</option>
        <optgroup label="Sample Saya">
          {samplesQuery.isLoading ? (
            <option disabled>Memuat...</option>
          ) : (
            samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </optgroup>
        <optgroup label="Sample Bawaan">
          <option disabled value="">
            {samplesQuery.isLoading ? 'Memuat...' : 'Segera tersedia'}
          </option>
        </optgroup>
      </select>
    </div>
  );
}
