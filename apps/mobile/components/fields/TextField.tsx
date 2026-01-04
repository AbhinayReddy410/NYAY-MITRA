import { Controller, type Control } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';

import type { FormValues } from '../formTypes';

const REQUIRED_MARK = '*';
const PLACEHOLDER_COLOR = '#94A3B8';
const TEXTAREA_LINES = 4;

interface TextFieldProps {
  name: string;
  label: string;
  required: boolean;
  control: Control<FormValues>;
  error?: string;
  placeholder?: string;
}

export function TextField({
  name,
  label,
  required,
  control,
  error,
  placeholder
}: TextFieldProps): JSX.Element {
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
              multiline
              numberOfLines={TEXTAREA_LINES}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor={PLACEHOLDER_COLOR}
              textAlignVertical='top'
              value={textValue}
            />
          );
        }}
      />
      {error ? <Text className='mt-2 text-xs text-red-600'>{error}</Text> : null}
    </View>
  );
}
