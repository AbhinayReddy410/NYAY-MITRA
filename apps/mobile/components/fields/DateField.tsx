import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Modal, Pressable, Text, View } from 'react-native';

import type { FormValues } from '../formTypes';

const REQUIRED_MARK = '*';
const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.4)';
const DATE_LOCALE = 'en-IN';
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const DATE_PLACEHOLDER = 'Select date';
const DONE_LABEL = 'Done';

interface DateFieldProps {
  name: string;
  label: string;
  required: boolean;
  control: Control<FormValues>;
  error?: string;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

export function DateField({ name, label, required, control, error }: DateFieldProps): JSX.Element {
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
          const currentDate = value instanceof Date ? value : null;
          const displayValue = currentDate ? formatDate(currentDate) : DATE_PLACEHOLDER;
          const pickerDate = currentDate ?? new Date();

          const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date): void => {
            if (selectedDate) {
              onChange(selectedDate);
            }
          };

          return (
            <>
              <Pressable
                className='mt-2 rounded-xl border border-slate-200 px-4 py-3'
                onPress={handleOpen}
              >
                <Text className={`text-sm ${currentDate ? 'text-slate-900' : 'text-slate-400'}`}>
                  {displayValue}
                </Text>
              </Pressable>

              <Modal animationType='fade' onRequestClose={handleClose} transparent visible={isOpen}>
                <Pressable
                  className='flex-1 justify-end'
                  onPress={handleClose}
                  style={{ backgroundColor: OVERLAY_COLOR }}
                >
                  <Pressable className='rounded-t-2xl bg-white px-6 pb-8 pt-4' onPress={handleCardPress}>
                    <View className='mb-4 flex-row items-center justify-between'>
                      <Text className='text-base font-semibold text-slate-900'>{label}</Text>
                      <Pressable onPress={handleClose}>
                        <Text className='text-sm font-semibold text-slate-600'>{DONE_LABEL}</Text>
                      </Pressable>
                    </View>
                    <DateTimePicker mode='date' onChange={handleChange} value={pickerDate} />
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
