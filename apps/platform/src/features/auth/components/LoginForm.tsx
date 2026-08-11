import { useState } from 'react';
import { FormField } from '../../../components/molecules/FormField';
import { Button } from '../../../components/atoms/Button';
import { useToast } from '../../../components/molecules/Toast';
import { usePostUsersLogin, type postUsersLoginResponse } from '../../../api/endpoints/users/users';
import { ApiError } from '../../../api/mutator/custom-instance';
import { useAuth } from '../AuthContext';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const loginMutation = usePostUsersLogin({
    mutation: {
      onSuccess: (response: postUsersLoginResponse) => {
        if (response.status === 200 && response.data.token) {
          login(response.data.token);
          addToast({ variant: 'success', title: 'Welcome back!', message: 'You have signed in successfully.' });
          onSuccess();
        }
      },
      onError: (error: Error) => {
        const message = error instanceof ApiError
          ? error.message
          : 'An unexpected error occurred. Please try again.';
        addToast({ variant: 'error', title: 'Sign in failed', message });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email: formData.email, password: formData.password } });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        id="email"
        name="email"
        type="email"
        label="Email address"
        onChange={handleChange}
        required
      />

      <FormField
        id="password"
        name="password"
        type="password"
        label="Password"
        onChange={handleChange}
        required
      />

      <Button
        type="submit"
        className="w-full"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
