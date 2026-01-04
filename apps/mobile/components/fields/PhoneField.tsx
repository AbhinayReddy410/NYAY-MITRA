import { Controller, type Control } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';

import type { FormValues } from '../formTypes';

const REQUIRED_MARK = '*';
const PLACEHOLDER_COLOR = '#94A3B8';
const COUNTRY_CODE = '+91';
const PHONE_LENGTH = 10;
const NON_DIGIT_REGEX = /[^0-9]/g;
const EMPTY_STRING = '';

interface PhoneFieldProps {
  name: string;
  label: string;
  required: boolean;
  control: Control<FormValues>;
  error?: string;
  placeholder?: string;
}

function sanitizePhoneInput(value: string): string {
  return value.replace(NON_DIGIT_REGEX, EMPTY_STRING).slice(0, PHONE_LENGTH);
}

export function PhoneField({
  name,
  label,
  required,
  control,
  error,
  placeholder
}: PhoneFieldProps): JSX.Element {
  return (
    <View className='mb-4'>
      <View className='flex-row items-center'>
        <Text className='text-sm font-medium text-slate-900'>{label}</Text>
        {required ? <Text className='ml-1 text-sm font-medium text-red-500'>{REQUIRED_MARK}</Text> : null}
      </View>
      <Controller
        control={control}
        name={name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <View className='mt-2 flex-row items-center rounded-xl border border-slate-200 px-4 py-3'>
              <Text className='text-sm text-slate-500'>{COUNTRY_CODE}</Text>
              <TextInput
                className='ml-2 flex-1 text-sm text-slate-900'
                keyboardType='number-pad'
                maxLength={PHONE_LENGTH}
                onBlur={onBlur}
                onChangeText={(text): void => onChange(sanitizePhoneInput(text))}
                placeholder={placeholder}
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={textValue}
              />
            </View>
          );
        }}
      />
      {error ? <Text className='mt-2 text-xs text-red-600'>{error}</Text> : null}
    </View>
  );
}
