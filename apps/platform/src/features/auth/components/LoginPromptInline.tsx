import { Link } from '@tanstack/react-router';

interface LoginPromptInlineProps {
  /** Aksi yang memicu prompt, mis. "menambah Section" — ditampilkan dalam pesan. */
  action?: string;
  /** Dipanggil saat Guest memilih untuk mengabaikan prompt. */
  onDismiss: () => void;
}

/**
 * Prompt "Login untuk edit" yang muncul INLINE di tempat Guest mencoba melakukan
 * aksi terbatas — bukan redirect paksa (FR-AUTH-07, PRD Bagian 10 keputusan #16).
 */
export function LoginPromptInline({ action, onDismiss }: LoginPromptInlineProps) {
  return (
    <div
      role="alert"
      className="mt-2 rounded-md border border-indigo-200 bg-indigo-50 p-3"
    >
      <p className="text-sm font-medium text-indigo-800">
        Login untuk {action ?? 'edit'}
      </p>
      <p className="mt-1 text-xs text-indigo-700">
        Fitur ini membutuhkan akun. Daftar atau masuk untuk melanjutkan — Anda tetap
        bisa menjelajah dalam mode lihat-saja.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-indigo-500"
        >
          Masuk
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center justify-center rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset transition-colors duration-150 hover:bg-gray-50"
        >
          Daftar
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline cursor-pointer"
        >
          Nanti saja
        </button>
      </div>
    </div>
  );
}
