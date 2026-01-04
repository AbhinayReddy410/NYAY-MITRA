'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';

const PHONE_TOTAL_DIGITS = 10;
const PHONE_REST_DIGITS = PHONE_TOTAL_DIGITS - 1;
const PHONE_FIRST_DIGIT_PATTERN = '[6-9]';
const PHONE_REGEX = new RegExp(`^${PHONE_FIRST_DIGIT_PATTERN}\\d{${PHONE_REST_DIGITS}}$`);

const TERMS_URL = 'https://nyayamitra.in/terms';
const PRIVACY_URL = 'https://nyayamitra.in/privacy';

const TITLE = 'Legal Drafts, Simplified';
const PHONE_PREFIX = '+91';
const GOOGLE_LABEL = 'Continue with Google';
const OTP_LABEL = 'Send OTP';
const OR_LABEL = 'OR';
const PHONE_PLACEHOLDER = 'Enter mobile number';
const PHONE_VALIDATION_MESSAGE = 'Enter a valid 10-digit mobile number starting with 6-9.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const GOOGLE_BUTTON_COLOR = 'bg-blue-600 hover:bg-blue-500';
const PRIMARY_BUTTON_COLOR = 'bg-slate-900 hover:bg-slate-800';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const { signInWithGoogle, signInWithPhone, isLoading } = useAuth();
  const [phone, setPhone] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [isOtpLoading, setIsOtpLoading] = useState<boolean>(false);

  const isBusy = isLoading || isGoogleLoading || isOtpLoading;

  const sanitizedPhone = useMemo((): string => phone.replace(/\D/g, ''), [phone]);

  const handlePhoneChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value.replace(/\D/g, '');
    setPhone(value);
    setErrorMessage('');
  }, []);

  const handleGooglePress = useCallback(async (): Promise<void> => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      setErrorMessage(message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [router, signInWithGoogle]);

  const handleOtpPress = useCallback(async (): Promise<void> => {
    if (!PHONE_REGEX.test(sanitizedPhone)) {
      setErrorMessage(PHONE_VALIDATION_MESSAGE);
      return;
    }

    setErrorMessage('');
    setIsOtpLoading(true);
    try {
      await signInWithPhone(sanitizedPhone);
      router.push(`/otp?phone=${sanitizedPhone}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      setErrorMessage(message);
    } finally {
      setIsOtpLoading(false);
    }
  }, [router, sanitizedPhone, signInWithPhone]);

  return (
    <div className='w-full'>
      <div className='flex flex-col px-2'>
        <div className='mt-8 flex flex-col items-center'>
          <div className='flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl font-semibold'>
            NM
          </div>
          <h1 className='mt-5 text-center text-2xl font-semibold text-slate-900'>{TITLE}</h1>
        </div>

        <div className='mt-10'>
          <Button
            className={`w-full ${GOOGLE_BUTTON_COLOR}`}
            disabled={isBusy}
            onClick={handleGooglePress}
            type='button'
          >
            {isGoogleLoading ? 'Signing in...' : GOOGLE_LABEL}
          </Button>

          <div className='my-6 flex items-center'>
            <div className='h-px flex-1 bg-slate-200' />
            <span className='mx-3 text-xs font-semibold tracking-widest text-slate-400'>{OR_LABEL}</span>
            <div className='h-px flex-1 bg-slate-200' />
          </div>

          <div className='flex items-center rounded-xl border border-slate-200 px-4 py-3'>
            <span className='mr-2 text-sm text-slate-500'>{PHONE_PREFIX}</span>
            <input
              className='flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400'
              maxLength={PHONE_TOTAL_DIGITS}
              onChange={handlePhoneChange}
              placeholder={PHONE_PLACEHOLDER}
              type='tel'
              value={phone}
            />
          </div>

          <Button
            className={`mt-4 w-full ${PRIMARY_BUTTON_COLOR}`}
            disabled={isBusy}
            onClick={handleOtpPress}
            type='button'
          >
            {isOtpLoading ? 'Sending...' : OTP_LABEL}
          </Button>

          {errorMessage ? <p className='mt-4 text-sm text-red-600'>{errorMessage}</p> : null}
        </div>

        <div id='recaptcha-container' className='mt-6' />

        <div className='mt-10 text-center text-xs text-slate-500'>
          By continuing, you agree to our{' '}
          <Link className='font-semibold text-slate-900' href={TERMS_URL} target='_blank'>
            Terms
          </Link>{' '}
          and{' '}
          <Link className='font-semibold text-slate-900' href={PRIVACY_URL} target='_blank'>
            Privacy Policy
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
