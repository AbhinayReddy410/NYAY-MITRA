import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput as TextInputType } from 'react-native';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

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
const SHAKE_OFFSET = 6;
const SHAKE_DURATION_MS = 40;
const SHAKE_RESET_VALUE = 0;
const FAILURE_REDIRECT_DELAY_MS = 800;

const RESEND_LABEL = 'Resend OTP';
const VERIFY_LABEL = 'Verify';
const BACK_LABEL = 'Back';

const OTP_INCOMPLETE_MESSAGE = 'Enter the 6-digit code.';
const OTP_FAILED_MESSAGE = 'Invalid code. Please try again.';
const OTP_LOCKED_MESSAGE = 'Too many failed attempts. Please try again.';
const PHONE_MISSING_MESSAGE = 'Missing phone number. Please go back.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const PRIMARY_BUTTON_COLOR = '#111827';
const BUTTON_TEXT_COLOR = '#FFFFFF';
const DISABLED_TEXT_COLOR = '#94A3B8';
const ACTIVE_TEXT_COLOR = '#111827';
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

function runShakeAnimation(shakeValue: Animated.Value): void {
  Animated.sequence([
    Animated.timing(shakeValue, {
      toValue: -SHAKE_OFFSET,
      duration: SHAKE_DURATION_MS,
      useNativeDriver: true
    }),
    Animated.timing(shakeValue, {
      toValue: SHAKE_OFFSET,
      duration: SHAKE_DURATION_MS,
      useNativeDriver: true
    }),
    Animated.timing(shakeValue, {
      toValue: -SHAKE_OFFSET,
      duration: SHAKE_DURATION_MS,
      useNativeDriver: true
    }),
    Animated.timing(shakeValue, {
      toValue: SHAKE_OFFSET,
      duration: SHAKE_DURATION_MS,
      useNativeDriver: true
    }),
    Animated.timing(shakeValue, {
      toValue: SHAKE_RESET_VALUE,
      duration: SHAKE_DURATION_MS,
      useNativeDriver: true
    })
  ]).start();
}

export function OtpScreen(): JSX.Element {
  const { verifyOtp, signInWithPhone, isLoading } = useAuth();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const sanitizedPhone = useMemo((): string => {
    if (typeof phone !== 'string') {
      return '';
    }
    return phone.replace(/\D/g, '');
  }, [phone]);
  const phoneSuffix = sanitizedPhone.slice(-LAST_FOUR_DIGITS);
  const displayPhoneSuffix = phoneSuffix.length === LAST_FOUR_DIGITS ? phoneSuffix : PHONE_PLACEHOLDER;

  const [otpDigits, setOtpDigits] = useState<string[]>((): string[] => createEmptyOtp());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(RESEND_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);

  const failedAttemptsRef = useRef<number>(0);
  const inputRefs = useRef<Array<TextInputType | null>>([]);
  const shakeAnimation = useRef<Animated.Value>(new Animated.Value(SHAKE_RESET_VALUE)).current;
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
  }, []);

  const handleFailure = useCallback(
    (message: string): void => {
      failedAttemptsRef.current += 1;
      runShakeAnimation(shakeAnimation);
      resetInputs();

      if (failedAttemptsRef.current >= MAX_FAILURES) {
        setErrorMessage(OTP_LOCKED_MESSAGE);
        scheduleBackNavigation();
        return;
      }

      setErrorMessage(message);
    },
    [resetInputs, scheduleBackNavigation, shakeAnimation]
  );

  const handleVerify = useCallback(async (): Promise<void> => {
    if (isVerifying) {
      return;
    }

    if (!isOtpComplete) {
      setErrorMessage(OTP_INCOMPLETE_MESSAGE);
      runShakeAnimation(shakeAnimation);
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);
    try {
      await verifyOtp(otpCode);
      router.replace('/(main)');
    } catch (error) {
      const message = error instanceof Error ? error.message : OTP_FAILED_MESSAGE;
      handleFailure(message);
    } finally {
      setIsVerifying(false);
    }
  }, [handleFailure, isOtpComplete, isVerifying, otpCode, shakeAnimation, verifyOtp]);

  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  const handleResend = useCallback(async (): Promise<void> => {
    if (!sanitizedPhone) {
      setErrorMessage(PHONE_MISSING_MESSAGE);
      return;
    }

    setErrorMessage(null);
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
      setErrorMessage(null);

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
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1 px-6'>
        <Pressable className='mt-4 self-start' disabled={isBusy} onPress={handleBack}>
          <Text className='text-sm text-slate-600'>{BACK_LABEL}</Text>
        </Pressable>

        <View className='mt-6'>
          <Text className='text-2xl font-semibold text-slate-900'>Enter OTP</Text>
          <Text className='mt-2 text-slate-500'>Code sent to +91 {displayPhoneSuffix}</Text>
        </View>

        <Animated.View
          className='mt-8 flex-row items-center'
          style={{ transform: [{ translateX: shakeAnimation }] }}
        >
          {otpDigits.map((digit, index) => (
            <TextInput
              key={`otp-${index}`}
              ref={(ref): void => {
                inputRefs.current[index] = ref;
              }}
              className={`h-12 w-12 rounded-xl border border-slate-200 text-center text-lg text-slate-900 ${
                index < LAST_INPUT_INDEX ? 'mr-2' : ''
              }`}
              editable={!isBusy}
              keyboardType='number-pad'
              maxLength={OTP_DIGIT_LENGTH}
              onChangeText={(value): void => handleInputChange(value, index)}
              value={digit}
            />
          ))}
        </Animated.View>

        {errorMessage ? <Text className='mt-4 text-sm text-red-600'>{errorMessage}</Text> : null}

        <View className='mt-6 flex-row items-center justify-between'>
          <Text className='text-sm text-slate-500'>Resend in {countdownText}</Text>
          <Pressable disabled={!canResend} onPress={handleResend}>
            <Text
              className='text-sm font-semibold'
              style={{ color: canResend ? ACTIVE_TEXT_COLOR : DISABLED_TEXT_COLOR }}
            >
              {RESEND_LABEL}
            </Text>
          </Pressable>
        </View>

        <Pressable
          className={`mt-8 w-full rounded-xl py-3 items-center ${isBusy ? 'opacity-60' : ''}`}
          disabled={isBusy}
          onPress={handleVerify}
          style={{ backgroundColor: PRIMARY_BUTTON_COLOR }}
        >
          {isVerifying ? (
            <ActivityIndicator color={BUTTON_TEXT_COLOR} />
          ) : (
            <Text className='text-white text-base font-semibold'>{VERIFY_LABEL}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
