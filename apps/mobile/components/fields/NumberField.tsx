import { Controller, type Control } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';

import type { FormValues } from '../formTypes';

const REQUIRED_MARK = '*';
const PLACEHOLDER_COLOR = '#94A3B8';
const NON_NUMERIC_REGEX = /[^0-9.]/g;
const DECIMAL_SEPARATOR = '.';
const EMPTY_STRING = '';

interface NumberFieldProps {
  name: string;
  label: string;
  required: boolean;
  control: Control<FormValues>;
  error?: string;
  placeholder?: string;
}

function sanitizeNumericInput(value: string): string {
  const cleaned = value.replace(NON_NUMERIC_REGEX, EMPTY_STRING);
  const parts = cleaned.split(DECIMAL_SEPARATOR);
  if (parts.length <= 1) {
    return cleaned;
  }
  const [first, ...rest] = parts;
  return `${first}${DECIMAL_SEPARATOR}${rest.join(EMPTY_STRING)}`;
}

export function NumberField({
  name,
  label,
  required,
  control,
  error,
  placeholder
}: NumberFieldProps): JSX.Element {
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
            <TextInput
              className='mt-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900'
              keyboardType='numeric'
              onBlur={onBlur}
              onChangeText={(text): void => onChange(sanitizeNumericInput(text))}
              placeholder={placeholder}
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={textValue}
            />
          );
        }}
      />
      {error ? <Text className='mt-2 text-xs text-red-600'>{error}</Text> : null}
    </View>
  );
}
