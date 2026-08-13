import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  primary: 'bg-brand-700 text-white hover:bg-brand-600 focus-visible:outline-brand-700',
  secondary: 'bg-white text-stone-900 ring-1 ring-stone-300 ring-inset hover:bg-stone-50',
  danger: 'bg-red-700 text-white hover:bg-red-600 focus-visible:outline-red-700',
  ghost: 'text-stone-700 hover:bg-stone-100',
};

const sizeStyles = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center rounded-md font-semibold
          shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2
          transition-colors duration-150 cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
