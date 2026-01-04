'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const HEADER_TITLE = 'NyayaMitra Admin';
const HEADER_SUBTITLE = 'Sign in to continue';
const EMAIL_LABEL = 'Email';
const EMAIL_PLACEHOLDER = 'admin@example.com';
const PASSWORD_LABEL = 'Password';
const PASSWORD_PLACEHOLDER = 'Your password';
const SIGNIN_LABEL = 'Sign In';
const DASHBOARD_PATH = '/dashboard';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const { signIn, isAuthenticated } = useAdminAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
    setError('');
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);

      try {
        await signIn(email, password);
        router.push(DASHBOARD_PATH);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign in failed';
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, signIn, router]
  );

  if (isAuthenticated) {
    router.replace(DASHBOARD_PATH);
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50'>
        <div className='text-sm text-slate-600'>Redirecting...</div>
      </div>
    );
  }

  const isFormValid = email.trim().length > 0 && password.length > 0;

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-50 px-4'>
      <Card className='w-full max-w-md'>
        <div className='text-center'>
          <h1 className='text-2xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
          <p className='mt-2 text-sm text-slate-600'>{HEADER_SUBTITLE}</p>
        </div>

        <form className='mt-8 space-y-4' onSubmit={handleSubmit}>
          <div>
            <label className='block text-sm font-medium text-slate-700' htmlFor='email'>
              {EMAIL_LABEL}
            </label>
            <Input
              autoComplete='email'
              className='mt-1'
              id='email'
              onChange={handleEmailChange}
              placeholder={EMAIL_PLACEHOLDER}
              type='email'
              value={email}
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-slate-700' htmlFor='password'>
              {PASSWORD_LABEL}
            </label>
            <Input
              autoComplete='current-password'
              className='mt-1'
              id='password'
              onChange={handlePasswordChange}
              placeholder={PASSWORD_PLACEHOLDER}
              type='password'
              value={password}
            />
          </div>

          {error ? <div className='text-sm text-red-600'>{error}</div> : null}

          <Button className='w-full' disabled={!isFormValid || isSubmitting} type='submit'>
            {isSubmitting ? 'Signing in...' : SIGNIN_LABEL}
          </Button>
        </form>
      </Card>
    </div>
  );
}
