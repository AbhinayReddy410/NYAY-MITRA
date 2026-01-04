'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';

const OTP_LENGTH = 6;
const OTP_DIGIT_LENGTH = 1;
const FIRST_INPUT_INDEX = 0;
const LAST_INPUT_INDEX = OTP_LENGTH - 1;
const SECONDS_PER_MINUTE = 60;
const RESEND_SECONDS = SECONDS_PER_MINUTE;
const MIN_COUNTDOWN = 0;
const MAX_FAILURES = 3;
const ONE_SECOND_MS = 1000;
const LAST_FOUR_DIGITS = 4;
const COUNTDOWN_PAD_LENGTH = 2;
const FAILURE_REDIRECT_DELAY_MS = 800;

const RESEND_LABEL = 'Resend OTP';
const VERIFY_LABEL = 'Verify';
const BACK_LABEL = 'Back';
const TITLE = 'Enter OTP';

const OTP_INCOMPLETE_MESSAGE = 'Enter the 6-digit code.';
const OTP_FAILED_MESSAGE = 'Invalid code. Please try again.';
const OTP_LOCKED_MESSAGE = 'Too many failed attempts. Please try again.';
const PHONE_MISSING_MESSAGE = 'Missing phone number. Please go back.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const PHONE_PLACEHOLDER = 'XXXX';

function createEmptyOtp(): string[] {
  return Array.from({ length: OTP_LENGTH }, (): string => '');
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const remainingSeconds = seconds % SECONDS_PER_MINUTE;
  const paddedSeconds = remainingSeconds.toString().padStart(COUNTDOWN_PAD_LENGTH, '0');
  return `${minutes}:${paddedSeconds}`;
}

export default function OtpPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp, signInWithPhone, isLoading } = useAuth();

  const phone = searchParams.get('phone');
  const sanitizedPhone = useMemo((): string => {
    if (!phone) {
      return '';
    }
    return phone.replace(/\D/g, '');
  }, [phone]);
  const phoneSuffix = sanitizedPhone.slice(-LAST_FOUR_DIGITS);
  const displayPhoneSuffix = phoneSuffix.length === LAST_FOUR_DIGITS ? phoneSuffix : PHONE_PLACEHOLDER;

  const [otpDigits, setOtpDigits] = useState<string[]>((): string[] => createEmptyOtp());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(RESEND_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);

  const failedAttemptsRef = useRef<number>(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const failureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const otpCode = otpDigits.join('');
  const isOtpComplete = otpDigits.every((digit) => digit.length === OTP_DIGIT_LENGTH);
  const isBusy = isLoading || isVerifying || isResending;
  const countdownText = useMemo((): string => formatCountdown(secondsRemaining), [secondsRemaining]);
  const canResend = secondsRemaining <= MIN_COUNTDOWN && !isBusy;

  const focusInput = useCallback((index: number): void => {
    const target = inputRefs.current[index];
    if (target) {
      target.focus();
    }
  }, []);

  const resetInputs = useCallback((): void => {
    setOtpDigits(createEmptyOtp());
    focusInput(FIRST_INPUT_INDEX);
  }, [focusInput]);

  const scheduleBackNavigation = useCallback((): void => {
    if (failureTimeoutRef.current) {
      clearTimeout(failureTimeoutRef.current);
    }
    failureTimeoutRef.current = setTimeout((): void => {
      router.back();
    }, FAILURE_REDIRECT_DELAY_MS);
  }, [router]);

  const handleFailure = useCallback(
    (message: string): void => {
      failedAttemptsRef.current += 1;
      resetInputs();

      if (failedAttemptsRef.current >= MAX_FAILURES) {
        setErrorMessage(OTP_LOCKED_MESSAGE);
        scheduleBackNavigation();
        return;
      }

      setErrorMessage(message);
    },
    [resetInputs, scheduleBackNavigation]
  );

  const handleVerify = useCallback(async (): Promise<void> => {
    if (isVerifying) {
      return;
    }

    if (!isOtpComplete) {
      setErrorMessage(OTP_INCOMPLETE_MESSAGE);
      return;
    }

    setErrorMessage('');
    setIsVerifying(true);
    try {
      await verifyOtp(otpCode);
      router.replace('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : OTP_FAILED_MESSAGE;
      handleFailure(message);
    } finally {
      setIsVerifying(false);
    }
  }, [handleFailure, isOtpComplete, isVerifying, otpCode, router, verifyOtp]);

  const handleBack = useCallback((): void => {
    router.back();
  }, [router]);

  const handleResend = useCallback(async (): Promise<void> => {
    if (!sanitizedPhone) {
      setErrorMessage(PHONE_MISSING_MESSAGE);
      return;
    }

    setErrorMessage('');
    setIsResending(true);
    try {
      await signInWithPhone(sanitizedPhone);
      failedAttemptsRef.current = 0;
      setSecondsRemaining(RESEND_SECONDS);
      resetInputs();
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      setErrorMessage(message);
    } finally {
      setIsResending(false);
    }
  }, [resetInputs, sanitizedPhone, signInWithPhone]);

  const handleInputChange = useCallback(
    (value: string, index: number): void => {
      const sanitized = value.replace(/\D/g, '');
      setErrorMessage('');

      if (!sanitized) {
        setOtpDigits((current) => {
          const updated = [...current];
          updated[index] = '';
          return updated;
        });
        if (index > FIRST_INPUT_INDEX) {
          focusInput(index - 1);
        }
        return;
      }

      const digits = sanitized.split('');
      setOtpDigits((current) => {
        const updated = [...current];
        digits.forEach((digit, offset) => {
          const targetIndex = index + offset;
          if (targetIndex < OTP_LENGTH) {
            updated[targetIndex] = digit;
          }
        });
        return updated;
      });

      const nextIndex = Math.min(index + digits.length, LAST_INPUT_INDEX);
      focusInput(nextIndex);
    },
    [focusInput]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, index: number): void => {
      if (event.key === 'Backspace' && !otpDigits[index] && index > FIRST_INPUT_INDEX) {
        focusInput(index - 1);
      }
    },
    [focusInput, otpDigits]
  );

  useEffect((): void => {
    focusInput(FIRST_INPUT_INDEX);
  }, [focusInput]);

  useEffect((): (() => void) | undefined => {
    if (secondsRemaining <= MIN_COUNTDOWN) {
      return undefined;
    }

    const intervalId = setInterval((): void => {
      setSecondsRemaining((current) => Math.max(current - 1, MIN_COUNTDOWN));
    }, ONE_SECOND_MS);

    return (): void => {
      clearInterval(intervalId);
    };
  }, [secondsRemaining]);

  useEffect((): (() => void) => {
    return (): void => {
      if (failureTimeoutRef.current) {
        clearTimeout(failureTimeoutRef.current);
      }
    };
  }, []);

  useEffect((): void => {
    if (isOtpComplete && !isVerifying) {
      void handleVerify();
    }
  }, [handleVerify, isOtpComplete, isVerifying]);

  return (
    <div className='w-full'>
      <div className='flex flex-col px-2'>
        <button
          className='mt-4 self-start text-sm text-slate-600 hover:text-slate-900 disabled:opacity-60'
          disabled={isBusy}
          onClick={handleBack}
          type='button'
        >
          {BACK_LABEL}
        </button>

        <div className='mt-6'>
          <h1 className='text-2xl font-semibold text-slate-900'>{TITLE}</h1>
          <p className='mt-2 text-slate-500'>
            Code sent to +91 {displayPhoneSuffix}
          </p>
        </div>

        <div className='mt-8 flex items-center gap-2'>
          {otpDigits.map((digit, index) => (
            <input
              key={`otp-${index}`}
              ref={(ref): void => {
                inputRefs.current[index] = ref;
              }}
              className='h-12 w-12 rounded-xl border border-slate-200 text-center text-lg text-slate-900 outline-none focus:border-slate-900 disabled:opacity-60'
              disabled={isBusy}
              inputMode='numeric'
              maxLength={OTP_DIGIT_LENGTH}
              onChange={(event): void => handleInputChange(event.target.value, index)}
              onKeyDown={(event): void => handleKeyDown(event, index)}
              type='text'
              value={digit}
            />
          ))}
        </div>

        {errorMessage ? <p className='mt-4 text-sm text-red-600'>{errorMessage}</p> : null}

        <div className='mt-6 flex items-center justify-between'>
          <p className='text-sm text-slate-500'>Resend in {countdownText}</p>
          <button
            className='text-sm font-semibold text-slate-900 hover:text-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed'
            disabled={!canResend}
            onClick={handleResend}
            type='button'
          >
            {RESEND_LABEL}
          </button>
        </div>

        <Button
          className='mt-8 w-full'
          disabled={isBusy}
          onClick={handleVerify}
          type='button'
        >
          {isVerifying ? 'Verifying...' : VERIFY_LABEL}
        </Button>
      </div>
    </div>
  );
}
