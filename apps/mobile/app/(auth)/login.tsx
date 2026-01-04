import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

const PHONE_TOTAL_DIGITS = 10;
const PHONE_REST_DIGITS = PHONE_TOTAL_DIGITS - 1;
const PHONE_FIRST_DIGIT_PATTERN = '[6-9]';
const PHONE_REGEX = new RegExp(`^${PHONE_FIRST_DIGIT_PATTERN}\\d{${PHONE_REST_DIGITS}}$`);

const TERMS_URL = 'https://nyayamitra.in/terms';
const PRIVACY_URL = 'https://nyayamitra.in/privacy';

const PHONE_VALIDATION_MESSAGE = 'Enter a valid 10-digit mobile number starting with 6-9.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const GOOGLE_BUTTON_COLOR = '#4285F4';
const PRIMARY_BUTTON_COLOR = '#111827';
const BUTTON_TEXT_COLOR = '#FFFFFF';

export function LoginScreen(): JSX.Element {
  const { signInWithGoogle, signInWithPhone, isLoading } = useAuth();
  const [phone, setPhone] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [isOtpLoading, setIsOtpLoading] = useState<boolean>(false);

  const isBusy = isLoading || isGoogleLoading || isOtpLoading;

  const handlePhoneChange = useCallback((value: string): void => {
    const sanitized = value.replace(/\D/g, '');
    setPhone(sanitized);
    setErrorMessage(null);
  }, []);

  const handleGooglePress = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      setErrorMessage(message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [signInWithGoogle]);

  const handleOtpPress = useCallback(async (): Promise<void> => {
    if (!PHONE_REGEX.test(phone)) {
      setErrorMessage(PHONE_VALIDATION_MESSAGE);
      return;
    }

    setErrorMessage(null);
    setIsOtpLoading(true);
    try {
      await signInWithPhone(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      setErrorMessage(message);
    } finally {
      setIsOtpLoading(false);
    }
  }, [phone, signInWithPhone]);

  const handleTermsPress = useCallback((): void => {
    void Linking.openURL(TERMS_URL);
  }, []);

  const handlePrivacyPress = useCallback((): void => {
    void Linking.openURL(PRIVACY_URL);
  }, []);

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1 px-6'>
        <View className='items-center mt-12'>
          <View className='h-20 w-20 rounded-2xl bg-slate-900 items-center justify-center'>
            <Text className='text-white text-xl font-semibold'>NM</Text>
          </View>
          <Text className='mt-5 text-2xl font-semibold text-slate-900'>Legal Drafts, Simplified</Text>
        </View>

        <View className='mt-10'>
          <Pressable
            className={`w-full rounded-xl py-3 items-center ${isBusy ? 'opacity-60' : ''}`}
            disabled={isBusy}
            onPress={handleGooglePress}
            style={{ backgroundColor: GOOGLE_BUTTON_COLOR }}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={BUTTON_TEXT_COLOR} />
            ) : (
              <Text className='text-white text-base font-semibold'>Continue with Google</Text>
            )}
          </Pressable>

          <View className='flex-row items-center my-6'>
            <View className='flex-1 h-px bg-slate-200' />
            <Text className='mx-3 text-slate-400 text-xs font-semibold tracking-widest'>OR</Text>
            <View className='flex-1 h-px bg-slate-200' />
          </View>

          <View className='flex-row items-center rounded-xl border border-slate-200 px-4 py-3'>
            <Text className='text-slate-500 mr-2'>+91</Text>
            <TextInput
              className='flex-1 text-slate-900'
              keyboardType='number-pad'
              maxLength={PHONE_TOTAL_DIGITS}
              onChangeText={handlePhoneChange}
              placeholder='Enter mobile number'
              placeholderTextColor='#94A3B8'
              value={phone}
            />
          </View>

          <Pressable
            className={`mt-4 w-full rounded-xl py-3 items-center ${isBusy ? 'opacity-60' : ''}`}
            disabled={isBusy}
            onPress={handleOtpPress}
            style={{ backgroundColor: PRIMARY_BUTTON_COLOR }}
          >
            {isOtpLoading ? (
              <ActivityIndicator color={BUTTON_TEXT_COLOR} />
            ) : (
              <Text className='text-white text-base font-semibold'>Send OTP</Text>
            )}
          </Pressable>

          {errorMessage ? (
            <Text className='mt-4 text-sm text-red-600'>{errorMessage}</Text>
          ) : null}
        </View>

        <View className='mt-auto pb-6 items-center'>
          <Text className='text-xs text-slate-500'>
            By continuing, you agree to our{' '}
            <Text className='text-slate-900 font-semibold' onPress={handleTermsPress}>
              Terms
            </Text>{' '}
            and{' '}
            <Text className='text-slate-900 font-semibold' onPress={handlePrivacyPress}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
