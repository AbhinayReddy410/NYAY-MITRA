import { useCallback, useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Modal, Pressable, Text, View } from 'react-native';

import type { SelectOption } from '@nyayamitra/shared';

import type { FormValues } from '../formTypes';

const REQUIRED_MARK = '*';
const PLACEHOLDER_COLOR = '#94A3B8';
const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.4)';
const EMPTY_STRING = '';
const OPTION_PLACEHOLDER = 'Select an option';
const CLOSE_LABEL = 'Close';

interface SelectFieldProps {
  name: string;
  label: string;
  required: boolean;
  control: Control<FormValues>;
  options: SelectOption[];
  error?: string;
}

function getSelectedLabel(options: SelectOption[], value: string): string {
  const match = options.find((option) => option.value === value);
  return match ? match.label : EMPTY_STRING;
}

export function SelectField({
  name,
  label,
  required,
  control,
  options,
  error
}: SelectFieldProps): JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleOpen = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const handleCardPress = useCallback((): void => {
    return;
  }, []);

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
          const currentValue = typeof value === 'string' ? value : EMPTY_STRING;
          const selectedLabel = getSelectedLabel(options, currentValue);
          const displayLabel = selectedLabel || OPTION_PLACEHOLDER;
          const isPlaceholder = selectedLabel.length === 0;

          return (
            <>
              <Pressable
                className='mt-2 rounded-xl border border-slate-200 px-4 py-3'
                onPress={handleOpen}
              >
                <Text
                  className={`text-sm ${isPlaceholder ? 'text-slate-400' : 'text-slate-900'}`}
                  style={{ color: isPlaceholder ? PLACEHOLDER_COLOR : undefined }}
                >
                  {displayLabel}
                </Text>
              </Pressable>

              <Modal animationType='fade' onRequestClose={handleClose} transparent visible={isOpen}>
                <Pressable
                  className='flex-1 justify-end'
                  onPress={handleClose}
                  style={{ backgroundColor: OVERLAY_COLOR }}
                >
                  <Pressable
                    className='rounded-t-2xl bg-white px-6 pb-8 pt-4'
                    onPress={handleCardPress}
                  >
                    <View className='mb-4 flex-row items-center justify-between'>
                      <Text className='text-base font-semibold text-slate-900'>{label}</Text>
                      <Pressable onPress={handleClose}>
                        <Text className='text-sm font-semibold text-slate-600'>{CLOSE_LABEL}</Text>
                      </Pressable>
                    </View>
                    <View>
                      {options.map((option) => {
                        const isSelected = option.value === currentValue;
                        return (
                          <Pressable
                            key={option.value}
                            className='py-3'
                            onPress={(): void => {
                              onChange(option.value);
                              handleClose();
                            }}
                          >
                            <Text className={`text-sm ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          );
        }}
      />
      {error ? <Text className='mt-2 text-xs text-red-600'>{error}</Text> : null}
    </View>
  );
}
