'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { z } from 'zod';

import type { ApiResponse, SelectOption, Template, TemplateVariable } from '@nyayamitra/shared';

import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { useAuth } from '../../../../contexts/AuthContext';
import { apiClient } from '../../../../lib/api';

type FormValues = Record<string, unknown>;

type DraftResponse = {
  draftId: string;
  downloadUrl: string;
  expiresAt: string;
};

const NO_LENGTH_LIMIT = 0;
const PHONE_TOTAL_LENGTH = 10;
const PHONE_START_LENGTH = 1;
const PHONE_START_PATTERN = '[6-9]';
const PHONE_REST_LENGTH = PHONE_TOTAL_LENGTH - PHONE_START_LENGTH;
const PHONE_REGEX = new RegExp(`^${PHONE_START_PATTERN}\\d{${PHONE_REST_LENGTH}}$`);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED_MESSAGE = 'Required';
const INVALID_EMAIL_MESSAGE = 'Enter a valid email';
const INVALID_PHONE_MESSAGE = 'Enter a valid phone number';
const INVALID_NUMBER_MESSAGE = 'Enter a valid number';
const INVALID_DATE_MESSAGE = 'Select a valid date';
const INVALID_OPTION_MESSAGE = 'Select a valid option';
const MIN_LENGTH_PREFIX = 'Minimum length is ';
const MAX_LENGTH_PREFIX = 'Maximum length is ';
const INVALID_PATTERN_MESSAGE = 'Invalid format';
const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const ERROR_MESSAGE = 'Unable to load template.';
const GENERATE_LABEL = 'Generate Draft';
const TEMPLATE_EMPTY_MESSAGE = 'No form fields for this template.';
const CREATE_DRAFT_ERROR = 'Unable to generate draft.';
const LOADING_MESSAGE = 'Loading...';
const RETRY_LABEL = 'Retry';
const REQUIRED_MARK = '*';
const SELECT_PLACEHOLDER = 'Select an option';
const DATE_PLACEHOLDER = 'Select date';
const DEFAULT_SECTION = 'General';

const EMPTY_STRING = '';
const EMPTY_ARRAY: string[] = [];

type TemplatePageProps = {
  params: {
    id: string;
  };
};

interface SectionGroup {
  title: string;
  fields: TemplateVariable[];
}

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function buildStringSchema(variable: TemplateVariable): z.ZodTypeAny {
  let schema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .min(1, { message: REQUIRED_MESSAGE });

  if (variable.minLength > NO_LENGTH_LIMIT) {
    schema = schema.min(variable.minLength, { message: `${MIN_LENGTH_PREFIX}${variable.minLength}` });
  }

  if (variable.maxLength > NO_LENGTH_LIMIT) {
    schema = schema.max(variable.maxLength, { message: `${MAX_LENGTH_PREFIX}${variable.maxLength}` });
  }

  const pattern = variable.pattern.trim();
  if (pattern.length > 0) {
    try {
      const regex = new RegExp(pattern);
      schema = schema.regex(regex, { message: INVALID_PATTERN_MESSAGE });
    } catch {
      return schema as z.ZodTypeAny;
    }
  }

  const finalSchema = variable.required ? schema : schema.optional();

  return z.preprocess(emptyStringToUndefined, finalSchema) as z.ZodTypeAny;
}

function buildNumberSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = z.number({ required_error: REQUIRED_MESSAGE, invalid_type_error: INVALID_NUMBER_MESSAGE });
  const schema = variable.required ? baseSchema : baseSchema.optional();

  return z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === EMPTY_STRING) {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      return Number.parseFloat(trimmed);
    }
    return value;
  }, schema) as z.ZodTypeAny;
}

function buildDateSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = z.date({ required_error: REQUIRED_MESSAGE, invalid_type_error: INVALID_DATE_MESSAGE });
  const schema = variable.required ? baseSchema : baseSchema.optional();

  return z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === EMPTY_STRING) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return parsed;
    }
    return value;
  }, schema) as z.ZodTypeAny;
}

function buildPhoneSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .regex(PHONE_REGEX, { message: INVALID_PHONE_MESSAGE });

  const schema = variable.required ? baseSchema : baseSchema.optional();

  return z.preprocess(emptyStringToUndefined, schema) as z.ZodTypeAny;
}

function buildEmailSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .regex(EMAIL_REGEX, { message: INVALID_EMAIL_MESSAGE });

  const schema = variable.required ? baseSchema : baseSchema.optional();

  return z.preprocess(emptyStringToUndefined, schema) as z.ZodTypeAny;
}

function buildSelectSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .min(1, { message: REQUIRED_MESSAGE })
    .refine((value) => variable.options.some((option) => option.value === value), {
      message: INVALID_OPTION_MESSAGE
    });

  const schema = variable.required ? baseSchema : baseSchema.optional();

  return z.preprocess(emptyStringToUndefined, schema) as z.ZodTypeAny;
}

function buildMultiSelectSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = variable.required
    ? z.array(z.string()).min(1, { message: REQUIRED_MESSAGE })
    : z.array(z.string()).optional();

  return baseSchema.refine(
    (values) => {
      if (!values) {
        return true;
      }
      return values.every((value) => variable.options.some((option) => option.value === value));
    },
    { message: INVALID_OPTION_MESSAGE }
  ) as z.ZodTypeAny;
}

function buildFormSchema(variables: TemplateVariable[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const variable of variables) {
    switch (variable.type) {
      case 'STRING':
      case 'TEXT':
        shape[variable.name] = buildStringSchema(variable);
        break;
      case 'DATE':
        shape[variable.name] = buildDateSchema(variable);
        break;
      case 'NUMBER':
      case 'CURRENCY':
        shape[variable.name] = buildNumberSchema(variable);
        break;
      case 'SELECT':
        shape[variable.name] = buildSelectSchema(variable);
        break;
      case 'MULTISELECT':
        shape[variable.name] = buildMultiSelectSchema(variable);
        break;
      case 'PHONE':
        shape[variable.name] = buildPhoneSchema(variable);
        break;
      case 'EMAIL':
        shape[variable.name] = buildEmailSchema(variable);
        break;
      default:
        shape[variable.name] = z.string().optional();
    }
  }

  return z.object(shape);
}

function buildDefaultValues(variables: TemplateVariable[]): FormValues {
  const values: FormValues = {};

  for (const variable of variables) {
    const defaultValue = variable.defaultValue;
    if (defaultValue !== undefined && defaultValue !== null) {
      if (variable.type === 'MULTISELECT') {
        values[variable.name] = Array.isArray(defaultValue) ? defaultValue : EMPTY_ARRAY;
        continue;
      }
      if (variable.type === 'DATE') {
        if (defaultValue instanceof Date) {
          values[variable.name] = defaultValue;
          continue;
        }
        if (typeof defaultValue === 'string' || typeof defaultValue === 'number') {
          const parsed = new Date(defaultValue);
          if (!Number.isNaN(parsed.getTime())) {
            values[variable.name] = parsed;
            continue;
          }
        }
      }
      if (typeof defaultValue === 'number') {
        values[variable.name] = `${defaultValue}`;
        continue;
      }
      if (typeof defaultValue === 'string') {
        values[variable.name] = defaultValue;
        continue;
      }
    }

    if (variable.type === 'MULTISELECT') {
      values[variable.name] = EMPTY_ARRAY;
    } else if (variable.type === 'DATE') {
      values[variable.name] = null;
    } else {
      values[variable.name] = EMPTY_STRING;
    }
  }

  return values;
}

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

async function fetchTemplate(templateId: string, token: string): Promise<Template> {
  const response = await apiClient
    .get(`templates/${templateId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<Template>>();

  return response.data;
}

async function createDraft(templateId: string, variables: FormValues, token: string): Promise<DraftResponse> {
  const response = await apiClient
    .post('drafts', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      json: {
        templateId,
        variables
      }
    })
    .json<ApiResponse<DraftResponse>>();

  return response.data;
}

interface FieldProps {
  variable: TemplateVariable;
  control: Control<FormValues>;
  error?: string;
}

function StringField({ variable, control, error }: FieldProps): JSX.Element {
  const placeholder = getPlaceholder(variable);
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <input
              className='mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 placeholder:text-slate-400'
              onBlur={onBlur}
              onChange={(e): void => onChange(e.target.value)}
              placeholder={placeholder}
              type='text'
              value={textValue}
            />
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function TextField({ variable, control, error }: FieldProps): JSX.Element {
  const placeholder = getPlaceholder(variable);
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <textarea
              className='mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 placeholder:text-slate-400'
              onBlur={onBlur}
              onChange={(e): void => onChange(e.target.value)}
              placeholder={placeholder}
              rows={4}
              value={textValue}
            />
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function NumberField({ variable, control, error }: FieldProps): JSX.Element {
  const placeholder = getPlaceholder(variable);
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <input
              className='mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 placeholder:text-slate-400'
              onBlur={onBlur}
              onChange={(e): void => onChange(e.target.value)}
              placeholder={placeholder}
              type='number'
              value={textValue}
            />
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function CurrencyField({ variable, control, error }: FieldProps): JSX.Element {
  const placeholder = getPlaceholder(variable);
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <div className='mt-2 flex items-center rounded-xl border border-slate-200 px-4 py-2'>
              <span className='text-sm text-slate-500'>₹</span>
              <input
                className='ml-2 flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400'
                onBlur={onBlur}
                onChange={(e): void => onChange(e.target.value)}
                placeholder={placeholder}
                type='number'
                value={textValue}
              />
            </div>
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function PhoneField({ variable, control, error }: FieldProps): JSX.Element {
  const placeholder = getPlaceholder(variable);
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <div className='mt-2 flex items-center rounded-xl border border-slate-200 px-4 py-2'>
              <span className='text-sm text-slate-500'>+91</span>
              <input
                className='ml-2 flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400'
                maxLength={PHONE_TOTAL_LENGTH}
                onBlur={onBlur}
                onChange={(e): void => onChange(e.target.value.replace(/\D/g, ''))}
                placeholder={placeholder}
                type='tel'
                value={textValue}
              />
            </div>
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function EmailField({ variable, control, error }: FieldProps): JSX.Element {
  const placeholder = getPlaceholder(variable);
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const textValue = typeof value === 'string' ? value : '';
          return (
            <input
              className='mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 placeholder:text-slate-400'
              onBlur={onBlur}
              onChange={(e): void => onChange(e.target.value)}
              placeholder={placeholder}
              type='email'
              value={textValue}
            />
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function SelectField({ variable, control, error }: FieldProps): JSX.Element {
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const currentValue = typeof value === 'string' ? value : EMPTY_STRING;
          return (
            <select
              className='mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400'
              onBlur={onBlur}
              onChange={(e): void => onChange(e.target.value)}
              value={currentValue}
            >
              <option value=''>{SELECT_PLACEHOLDER}</option>
              {variable.options.map((option: SelectOption) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function MultiSelectField({ variable, control, error }: FieldProps): JSX.Element {
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onChange, value } }): JSX.Element => {
          const currentValues = Array.isArray(value) ? value : EMPTY_ARRAY;
          return (
            <div className='mt-2 space-y-2'>
              {variable.options.map((option: SelectOption) => {
                const isChecked = currentValues.includes(option.value);
                return (
                  <label key={option.value} className='flex items-center cursor-pointer'>
                    <input
                      checked={isChecked}
                      className='mr-2 h-4 w-4'
                      onChange={(e): void => {
                        if (e.target.checked) {
                          onChange([...currentValues, option.value]);
                        } else {
                          onChange(currentValues.filter((v: string) => v !== option.value));
                        }
                      }}
                      type='checkbox'
                    />
                    <span className='text-sm text-slate-700'>{option.label}</span>
                  </label>
                );
              })}
            </div>
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function DateField({ variable, control, error }: FieldProps): JSX.Element {
  return (
    <div className='mb-4'>
      <label className='flex items-center text-sm font-medium text-slate-900'>
        {variable.label}
        {variable.required ? <span className='ml-1 text-red-500'>{REQUIRED_MARK}</span> : null}
      </label>
      <Controller
        control={control}
        name={variable.name}
        render={({ field: { onBlur, onChange, value } }): JSX.Element => {
          const dateValue = value instanceof Date ? value.toISOString().split('T')[0] : '';
          return (
            <input
              className='mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400'
              onBlur={onBlur}
              onChange={(e): void => {
                const val = e.target.value;
                if (val) {
                  onChange(new Date(val));
                } else {
                  onChange(null);
                }
              }}
              placeholder={DATE_PLACEHOLDER}
              type='date'
              value={dateValue}
            />
          );
        }}
      />
      {error ? <p className='mt-1 text-xs text-red-600'>{error}</p> : null}
    </div>
  );
}

function DynamicForm({
  schema,
  control,
  errors
}: {
  schema: TemplateVariable[];
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
}): JSX.Element {
  const sections = useMemo((): SectionGroup[] => groupSections(schema), [schema]);

  return (
    <div>
      {sections.map((section) => (
        <div key={section.title} className='mb-6'>
          <h3 className='mb-4 text-base font-semibold text-slate-900'>{section.title}</h3>
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            {section.fields.map((field) => {
              const errorMessage = getErrorMessage(errors, field.name);
              const props = { variable: field, control, error: errorMessage };

              switch (field.type) {
                case 'STRING':
                  return <StringField key={field.name} {...props} />;
                case 'TEXT':
                  return <TextField key={field.name} {...props} />;
                case 'DATE':
                  return <DateField key={field.name} {...props} />;
                case 'NUMBER':
                  return <NumberField key={field.name} {...props} />;
                case 'CURRENCY':
                  return <CurrencyField key={field.name} {...props} />;
                case 'SELECT':
                  return <SelectField key={field.name} {...props} />;
                case 'MULTISELECT':
                  return <MultiSelectField key={field.name} {...props} />;
                case 'PHONE':
                  return <PhoneField key={field.name} {...props} />;
                case 'EMAIL':
                  return <EmailField key={field.name} {...props} />;
                default:
                  return null;
              }
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TemplatePage({ params }: TemplatePageProps): JSX.Element {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const templateId = params.id;

  const templateQuery = useQuery({
    queryKey: ['template', templateId],
    queryFn: async (): Promise<Template> => {
      if (!firebaseUser) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return fetchTemplate(templateId, token);
    },
    enabled: Boolean(templateId && firebaseUser)
  });

  const template = templateQuery.data;
  const variables = template?.variables ?? [];
  const formSchema = useMemo((): z.ZodObject<z.ZodRawShape> => buildFormSchema(variables), [variables]);
  const defaultValues = useMemo((): FormValues => buildDefaultValues(variables), [variables]);
  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    reset,
    trigger
  } = useForm<FormValues>({
    defaultValues,
    mode: 'onChange',
    resolver
  });

  useEffect((): void => {
    reset(defaultValues);
    void trigger();
  }, [defaultValues, reset, trigger]);

  const generateMutation = useMutation({
    mutationFn: async (values: FormValues): Promise<DraftResponse> => {
      if (!firebaseUser) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return createDraft(templateId, values, token);
    },
    onSuccess: (data: DraftResponse): void => {
      router.push(`/draft/${data.draftId}?downloadUrl=${encodeURIComponent(data.downloadUrl)}&templateName=${encodeURIComponent(template?.name ?? EMPTY_STRING)}`);
    }
  });

  const handleGenerate = useCallback(
    handleSubmit((values: FormValues): void => {
      generateMutation.mutate(values);
    }),
    [generateMutation, handleSubmit]
  );

  const handleRetry = useCallback((): void => {
    void templateQuery.refetch();
  }, [templateQuery]);

  if (!templateId) {
    return (
      <Card>
        <p className='text-sm text-red-600'>{ERROR_MESSAGE}</p>
      </Card>
    );
  }

  if (!firebaseUser || templateQuery.isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-slate-500'>{LOADING_MESSAGE}</p>
      </div>
    );
  }

  if (templateQuery.isError) {
    const message = templateQuery.error instanceof Error ? templateQuery.error.message : ERROR_MESSAGE;
    return (
      <Card>
        <p className='text-sm text-red-600'>{message}</p>
        <button
          className='mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800'
          onClick={handleRetry}
          type='button'
        >
          {RETRY_LABEL}
        </button>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <p className='text-sm text-slate-500'>{TEMPLATE_EMPTY_MESSAGE}</p>
      </Card>
    );
  }

  const isGenerating = generateMutation.isPending;
  const isDisabled = !isValid || isGenerating;
  let mutationError = EMPTY_STRING;
  if (generateMutation.error instanceof Error) {
    mutationError = generateMutation.error.message;
  } else if (generateMutation.error) {
    mutationError = CREATE_DRAFT_ERROR;
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-semibold text-slate-900'>{template.name}</h1>
        <p className='mt-2 text-sm text-slate-500'>{template.description}</p>
      </div>

      <Card>
        <DynamicForm control={control} errors={errors} schema={variables} />

        {mutationError ? <p className='mt-4 text-xs text-red-600'>{mutationError}</p> : null}
        <div className='mt-6'>
          <Button className='w-full lg:w-auto' disabled={isDisabled} onClick={handleGenerate} type='button'>
            {isGenerating ? LOADING_MESSAGE : GENERATE_LABEL}
          </Button>
        </div>
      </Card>
    </div>
  );
}
