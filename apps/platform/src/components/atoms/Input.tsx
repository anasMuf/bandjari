import { type InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          block w-full rounded-md bg-white px-3 py-2 text-base text-stone-900
          outline-1 -outline-offset-1 outline-stone-300
          placeholder:text-stone-400
          focus:outline-2 focus:-outline-offset-2 focus:outline-brand-700
          sm:text-sm/6
          ${className}
        `}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
