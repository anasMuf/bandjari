import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const variantStyles: Record<ToastVariant, { bg: string; icon: string; text: string; border: string }> = {
  success: { bg: 'bg-white', icon: 'text-green-400', text: 'text-gray-900', border: 'ring-1 ring-gray-200' },
  error: { bg: 'bg-white', icon: 'text-red-400', text: 'text-gray-900', border: 'ring-1 ring-gray-200' },
  warning: { bg: 'bg-white', icon: 'text-yellow-400', text: 'text-gray-900', border: 'ring-1 ring-gray-200' },
  info: { bg: 'bg-white', icon: 'text-blue-400', text: 'text-gray-900', border: 'ring-1 ring-gray-200' },
};

const icons: Record<ToastVariant, ReactNode> = {
  success: (
    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
    </svg>
  ),
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const styles = variantStyles[toast.variant];

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ${styles.bg} ${styles.border} animate-[slideIn_0.3s_ease-out]`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className={`shrink-0 ${styles.icon}`}>
            {icons[toast.variant]}
          </div>
          <div className="ml-3 w-0 flex-1">
            {toast.title && (
              <p className={`text-sm font-medium ${styles.text}`}>{toast.title}</p>
            )}
            <p className={`text-sm ${toast.title ? 'mt-1 text-gray-500' : styles.text}`}>
              {toast.message}
            </p>
          </div>
          <div className="ml-4 flex shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
              onClick={() => onRemove(toast.id)}
            >
              <span className="sr-only">Close</span>
              <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TOAST_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-dismiss
    setTimeout(() => removeToast(id), TOAST_DURATION);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast Container */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-100 flex items-start justify-end px-4 py-6 sm:p-6"
      >
        <div className="flex w-full flex-col items-end gap-3">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
