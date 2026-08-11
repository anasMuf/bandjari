import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, id, type, ...props }, ref) => {
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <div className="relative mt-2">
          <Input
            id={id}
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            {...props}
            className={isPassword ? 'pr-14' : ''}
          />
          {isPassword && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </div>
    );
  }
);

FormField.displayName = 'FormField';
