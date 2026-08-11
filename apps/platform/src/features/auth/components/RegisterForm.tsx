import { useState } from 'react';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostUsersRegister, type postUsersRegisterResponse } from '../../../api/endpoints/users/users';
import { ApiError } from '../../../api/mutator/custom-instance';

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    address: '',
  });

  const registerMutation = usePostUsersRegister({
    mutation: {
      onSuccess: (response: postUsersRegisterResponse) => {
        if (response.status === 201) {
          addToast({ variant: 'success', title: 'Account created!', message: 'Please sign in with your new account.' });
          onSuccess();
        } else if (response.status === 400 && 'message' in response.data) {
          addToast({ variant: 'error', title: 'Registration failed', message: response.data.message || 'Please check your input.' });
        }
      },
      onError: (error: Error) => {
        const message = error instanceof ApiError
          ? error.message
          : 'An unexpected error occurred. Please try again.';
        addToast({ variant: 'error', title: 'Registration failed', message });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: formData });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <FormField
          id="full_name" name="full_name" type="text" label="Full Name"
          onChange={handleChange} required maxLength={100} minLength={3}
        />
        <FormField
          id="username" name="username" type="text" label="Username"
          onChange={handleChange} required maxLength={50} minLength={3}
        />
      </div>

      <FormField
        id="email" name="email" type="email" label="Email address"
        onChange={handleChange} required maxLength={100}
      />

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <FormField
          id="phone" name="phone" type="tel" label="Phone"
          onChange={handleChange} required maxLength={15}
        />
        <FormField
          id="address" name="address" type="text" label="Address"
          onChange={handleChange} required
        />
      </div>

      <FormField
        id="password" name="password" type="password" label="Password"
        onChange={handleChange} required minLength={6} maxLength={100}
      />

      <Button
        type="submit"
        className="w-full"
        disabled={registerMutation.isPending}
      >
        {registerMutation.isPending ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}
