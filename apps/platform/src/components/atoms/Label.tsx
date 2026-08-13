import type { LabelHTMLAttributes } from 'react';

export function Label({ className = '', children, htmlFor, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm/6 font-medium text-stone-900 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
