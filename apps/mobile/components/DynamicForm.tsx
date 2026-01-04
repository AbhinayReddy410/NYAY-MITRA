import { Fragment, useMemo } from 'react';
import type { Control, FieldErrors } from 'react-hook-form';
import { Text, View } from 'react-native';

import type { TemplateVariable } from '@nyayamitra/shared';

import { CurrencyField } from './fields/CurrencyField';
import { DateField } from './fields/DateField';
import { EmailField } from './fields/EmailField';
import { MultiSelectField } from './fields/MultiSelectField';
import { NumberField } from './fields/NumberField';
import { PhoneField } from './fields/PhoneField';
import { SelectField } from './fields/SelectField';
import { StringField } from './fields/StringField';
import { TextField } from './fields/TextField';
import type { FormValues } from './formTypes';

interface DynamicFormProps {
  schema: TemplateVariable[];
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
}

interface SectionGroup {
  title: string;
  fields: TemplateVariable[];
}

const DEFAULT_SECTION = 'General';
const EMPTY_STRING = '';

function normalizeSection(section: string): string {
  const trimmed = section.trim();
  if (!trimmed) {
    return DEFAULT_SECTION;
  }
  return trimmed;
}

function groupSections(variables: TemplateVariable[]): SectionGroup[] {
  const sorted = [...variables].sort((a, b) => a.order - b.order);
  const groups = new Map<string, TemplateVariable[]>();

  for (const variable of sorted) {
    const key = normalizeSection(variable.section ?? EMPTY_STRING);
    const existing = groups.get(key);
    if (existing) {
      existing.push(variable);
    } else {
      groups.set(key, [variable]);
    }
  }

  return Array.from(groups.entries()).map(([title, fields]) => ({ title, fields }));
}

function getErrorMessage(errors: FieldErrors<FormValues>, name: string): string | undefined {
  const error = errors[name];
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if ('message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return undefined;
}

function getPlaceholder(variable: TemplateVariable): string | undefined {
  const placeholder = variable.placeholder?.trim() ?? EMPTY_STRING;
  return placeholder.length > 0 ? placeholder : undefined;
}

export function DynamicForm({ schema, control, errors }: DynamicFormProps): JSX.Element {
  const sections = useMemo((): SectionGroup[] => groupSections(schema), [schema]);

  return (
    <View>
      {sections.map((section) => (
        <Fragment key={section.title}>
          <Text className='mb-3 text-base font-semibold text-slate-900'>{section.title}</Text>
          {section.fields.map((field) => {
            const errorMessage = getErrorMessage(errors, field.name);
            const placeholder = getPlaceholder(field);

            switch (field.type) {
              case 'STRING':
                return (
                  <StringField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    placeholder={placeholder}
                    required={field.required}
                  />
                );
              case 'TEXT':
                return (
                  <TextField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    placeholder={placeholder}
                    required={field.required}
                  />
                );
              case 'DATE':
                return (
                  <DateField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    required={field.required}
                  />
                );
              case 'NUMBER':
                return (
                  <NumberField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    placeholder={placeholder}
                    required={field.required}
                  />
                );
              case 'CURRENCY':
                return (
                  <CurrencyField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    placeholder={placeholder}
                    required={field.required}
                  />
                );
              case 'SELECT':
                return (
                  <SelectField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    options={field.options}
                    required={field.required}
                  />
                );
              case 'MULTISELECT':
                return (
                  <MultiSelectField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    options={field.options}
                    required={field.required}
                  />
                );
              case 'PHONE':
                return (
                  <PhoneField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    placeholder={placeholder}
                    required={field.required}
                  />
                );
              case 'EMAIL':
                return (
                  <EmailField
                    key={field.name}
                    control={control}
                    error={errorMessage}
                    label={field.label}
                    name={field.name}
                    placeholder={placeholder}
                    required={field.required}
                  />
                );
              default:
                return null;
            }
          })}
        </Fragment>
      ))}
    </View>
  );
}
