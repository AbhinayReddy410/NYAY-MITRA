import { Ionicons } from '@expo/vector-icons';
import { Controller, type Control } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import type { SelectOption } from '@nyayamitra/shared';

import type { FormValues } from '../formTypes';

const REQUIRED_MARK = '*';
const CHECKED_ICON = 'checkbox-outline';
const UNCHECKED_ICON = 'square-outline';
const ICON_SIZE = 18;
const ICON_COLOR = '#0F172A';

interface MultiSelectFieldProps {
  name: string;
  label: string;
  required: boolean;
  control: Control<FormValues>;
  options: SelectOption[];
  error?: string;
}

function toggleValue(values: string[], nextValue: string): string[] {
  if (values.includes(nextValue)) {
    return values.filter((value) => value !== nextValue);
  }
  return [...values, nextValue];
}

export function MultiSelectField({
  name,
  label,
  required,
  control,
  options,
  error
}: MultiSelectFieldProps): JSX.Element {

  return (
    <View className='mb-4'>
      <View className='flex-row items-center'>
        <Text className='text-sm font-medium text-slate-900'>{label}</Text>
        {required ? <Text className='ml-1 text-sm font-medium text-red-500'>{REQUIRED_MARK}</Text> : null}
      </View>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }): JSX.Element => {
          const selectedValues = Array.isArray(value) ? value : [];
          return (
            <View className='mt-2 rounded-xl border border-slate-200 px-4 py-2'>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    className='flex-row items-center py-2'
                    onPress={(): void => onChange(toggleValue(selectedValues, option.value))}
                  >
                    <Ionicons
                      color={ICON_COLOR}
                      name={isSelected ? CHECKED_ICON : UNCHECKED_ICON}
                      size={ICON_SIZE}
                    />
                    <Text className='ml-2 text-sm text-slate-700'>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        }}
      />
      {error ? <Text className='mt-2 text-xs text-red-600'>{error}</Text> : null}
    </View>
  );
}
