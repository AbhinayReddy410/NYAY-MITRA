import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import type { ApiResponse, Template, TemplateVariable } from '@nyayamitra/shared';

import { DynamicForm } from '../../../../components/DynamicForm';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingSpinner } from '../../../../components/LoadingSpinner';
import type { FormValues } from '../../../../components/formTypes';
import { useAuth } from '../../../../contexts/AuthContext';
import { apiClient } from '../../../../services/api';
import { firebaseAuth } from '../../../../services/firebase';

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

const EMPTY_STRING = '';
const EMPTY_ARRAY: string[] = [];

const HEADER_ICON_SIZE = 20;
const HEADER_ICON_COLOR = '#0F172A';
const BUTTON_TEXT_COLOR = '#FFFFFF';
const BUTTON_BACKGROUND = '#0F172A';
const BUTTON_DISABLED = '#94A3B8';
const FOOTER_BORDER = '#E2E8F0';

const FOOTER_SPACING = 140;
const FORM_CONTENT_STYLE = { paddingBottom: FOOTER_SPACING } as const;

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
      return schema;
    }
  }

  const finalSchema = variable.required ? schema : schema.optional();

  return z.preprocess(emptyStringToUndefined, finalSchema);
}

function buildNumberSchema(variable: TemplateVariable): z.ZodTypeAny {
  const schema = z.number({ required_error: REQUIRED_MESSAGE, invalid_type_error: INVALID_NUMBER_MESSAGE });
  const finalSchema = variable.required ? schema : schema.optional();

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
  }, finalSchema);
}

function buildDateSchema(variable: TemplateVariable): z.ZodTypeAny {
  const schema = z.date({ required_error: REQUIRED_MESSAGE, invalid_type_error: INVALID_DATE_MESSAGE });
  const finalSchema = variable.required ? schema : schema.optional();

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
  }, finalSchema);
}

function buildPhoneSchema(variable: TemplateVariable): z.ZodTypeAny {
  const schema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .regex(PHONE_REGEX, { message: INVALID_PHONE_MESSAGE });

  const finalSchema = variable.required ? schema : schema.optional();

  return z.preprocess(emptyStringToUndefined, finalSchema);
}

function buildEmailSchema(variable: TemplateVariable): z.ZodTypeAny {
  const schema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .regex(EMAIL_REGEX, { message: INVALID_EMAIL_MESSAGE });

  const finalSchema = variable.required ? schema : schema.optional();

  return z.preprocess(emptyStringToUndefined, finalSchema);
}

function buildSelectSchema(variable: TemplateVariable): z.ZodTypeAny {
  const schema = z
    .string({ required_error: REQUIRED_MESSAGE })
    .trim()
    .min(1, { message: REQUIRED_MESSAGE })
    .refine((value) => variable.options.some((option) => option.value === value), {
      message: INVALID_OPTION_MESSAGE
    });

  const finalSchema = variable.required ? schema : schema.optional();

  return z.preprocess(emptyStringToUndefined, finalSchema);
}

function buildMultiSelectSchema(variable: TemplateVariable): z.ZodTypeAny {
  const baseSchema = z.array(z.string());
  const schema = variable.required ? baseSchema.min(1, { message: REQUIRED_MESSAGE }) : baseSchema.optional();

  return schema.refine(
    (values) => {
      if (!values) {
        return true;
      }
      return values.every((value) => variable.options.some((option) => option.value === value));
    },
    { message: INVALID_OPTION_MESSAGE }
  );
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

async function getAuthToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }
  return currentUser.getIdToken();
}

async function fetchTemplate(templateId: string): Promise<Template> {
  const token = await getAuthToken();
  const response = await apiClient
    .get(`templates/${templateId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<Template>>();

  return response.data;
}

async function createDraft(templateId: string, variables: FormValues): Promise<DraftResponse> {
  const token = await getAuthToken();
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

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorState({ message, onRetry, isRetrying }: ErrorStateProps): JSX.Element {
  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1 items-center justify-center px-6'>
        <Text className='text-center text-sm text-slate-600'>{message}</Text>
        <Pressable
          className={`mt-4 rounded-full px-4 py-2 ${isRetrying ? 'opacity-60' : ''}`}
          disabled={isRetrying}
          onPress={onRetry}
        >
          <Text className='text-sm font-semibold text-slate-900'>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function TemplateScreen(): JSX.Element {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const templateId = typeof id === 'string' ? id : '';

  const templateQuery = useQuery({
    queryKey: ['template', templateId],
    queryFn: (): Promise<Template> => fetchTemplate(templateId),
    enabled: Boolean(templateId && user)
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
    mutationFn: async (values: FormValues): Promise<DraftResponse> => createDraft(templateId, values),
    onSuccess: (data: DraftResponse): void => {
      router.push({
        pathname: '/draft/[id]',
        params: { id: data.draftId, downloadUrl: data.downloadUrl, templateName: template?.name ?? EMPTY_STRING }
      });
    }
  });

  const handleGenerate = useCallback(
    handleSubmit((values: FormValues): void => {
      generateMutation.mutate(values);
    }),
    [generateMutation, handleSubmit]
  );

  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  if (!templateId) {
    return <ErrorState isRetrying={false} message={ERROR_MESSAGE} onRetry={handleBack} />;
  }

  if (!user || templateQuery.isLoading) {
    return <LoadingSpinner />;
  }

  if (templateQuery.isError) {
    const message = templateQuery.error instanceof Error ? templateQuery.error.message : ERROR_MESSAGE;
    return <ErrorState isRetrying={templateQuery.isFetching} message={message} onRetry={templateQuery.refetch} />;
  }

  if (!template) {
    return <EmptyState message={TEMPLATE_EMPTY_MESSAGE} />;
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
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1'>
        <View className='px-6 pt-4'>
          <View className='flex-row items-center'>
            <Pressable className='mr-3 h-10 w-10 items-center justify-center rounded-full bg-slate-100' onPress={handleBack}>
              <Ionicons name='chevron-back' size={HEADER_ICON_SIZE} color={HEADER_ICON_COLOR} />
            </Pressable>
            <Text className='text-base font-semibold text-slate-900'>{template.name}</Text>
          </View>
        </View>

        <ScrollView className='flex-1 px-6' contentContainerStyle={FORM_CONTENT_STYLE} showsVerticalScrollIndicator={false}>
          <DynamicForm control={control} errors={errors} schema={variables} />
        </ScrollView>

        <View
          className='absolute bottom-0 left-0 right-0 border-t px-6 py-4'
          style={{ backgroundColor: 'white', borderColor: FOOTER_BORDER }}
        >
          {mutationError ? <Text className='mb-2 text-xs text-red-600'>{mutationError}</Text> : null}
          <Pressable
            className={`w-full rounded-xl py-3 items-center ${isDisabled ? 'opacity-70' : ''}`}
            disabled={isDisabled}
            onPress={handleGenerate}
            style={{ backgroundColor: isDisabled ? BUTTON_DISABLED : BUTTON_BACKGROUND }}
          >
            {isGenerating ? (
              <ActivityIndicator color={BUTTON_TEXT_COLOR} />
            ) : (
              <Text className='text-base font-semibold text-white'>{GENERATE_LABEL}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
