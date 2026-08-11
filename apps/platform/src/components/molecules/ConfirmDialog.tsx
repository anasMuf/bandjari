import { useEffect, useCallback, type ReactNode } from 'react';
import { Button } from '../atoms/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {

  // Handle ESC key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const iconBg = variant === 'danger' ? 'bg-red-100' : 'bg-indigo-100';
  const iconColor = variant === 'danger' ? 'text-red-600' : 'text-indigo-600';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500/75 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Centering container */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Dialog panel */}
        <div
          className="relative w-full max-w-lg rounded-lg bg-white shadow-xl sm:w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              {/* Icon */}
              <div className={`mx-auto flex size-12 shrink-0 items-center justify-center rounded-full sm:mx-0 sm:size-10 ${iconBg}`}>
                {variant === 'danger' ? (
                  <svg className={`size-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                ) : (
                  <svg className={`size-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                {description && (
                  <p className="mt-2 text-sm text-gray-500">{description}</p>
                )}
                {children && (
                  <div className="mt-2 text-sm text-gray-500">{children}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-b-lg bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <Button
              type="button"
              variant={variant}
              size="md"
              className="w-full sm:ml-3 sm:w-auto"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="mt-3 w-full sm:mt-0 sm:w-auto"
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
