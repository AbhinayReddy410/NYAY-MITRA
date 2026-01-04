import type { TemplateVariable } from '@nyayamitra/shared';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized: Record<string, unknown>;
}

interface FieldResult {
  value?: unknown;
  errors: ValidationError[];
}

const ERROR_CODES = {
  REQUIRED: 'REQUIRED',
  INVALID_TYPE: 'INVALID_TYPE',
  MIN_LENGTH: 'MIN_LENGTH',
  MAX_LENGTH: 'MAX_LENGTH',
  PATTERN: 'PATTERN',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_NUMBER: 'INVALID_NUMBER',
  INVALID_OPTION: 'INVALID_OPTION',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_EMAIL: 'INVALID_EMAIL'
} as const;

const EMPTY_LENGTH = 0;
const NO_LENGTH_LIMIT = 0;
const PHONE_TOTAL_LENGTH = 10;
const PHONE_START_LENGTH = 1;
const PHONE_START_PATTERN = '[6-9]';
const PHONE_REST_LENGTH = PHONE_TOTAL_LENGTH - PHONE_START_LENGTH;
const PHONE_REGEX = new RegExp(`^${PHONE_START_PATTERN}[0-9]{${PHONE_REST_LENGTH}}$`);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

function addError(errors: ValidationError[], field: string, code: string, message: string): void {
  errors.push({ field, code, message });
}

function validateRequiredString(
  variable: TemplateVariable,
  rawValue: unknown,
  errors: ValidationError[]
): string | undefined {
  if (isMissing(rawValue)) {
    if (variable.required) {
      addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
    }
    return undefined;
  }

  if (typeof rawValue !== 'string') {
    addError(errors, variable.name, ERROR_CODES.INVALID_TYPE, 'Value must be a string');
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === EMPTY_LENGTH) {
    if (variable.required) {
      addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
    }
    return undefined;
  }

  return trimmed;
}

function validateStringValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];
  const trimmed = validateRequiredString(variable, rawValue, errors);

  if (!trimmed) {
    return { errors };
  }

  if (variable.minLength > NO_LENGTH_LIMIT && trimmed.length < variable.minLength) {
    addError(errors, variable.name, ERROR_CODES.MIN_LENGTH, 'Value is too short');
  }

  if (variable.maxLength > NO_LENGTH_LIMIT && trimmed.length > variable.maxLength) {
    addError(errors, variable.name, ERROR_CODES.MAX_LENGTH, 'Value is too long');
  }

  const pattern = variable.pattern.trim();
  if (pattern.length > EMPTY_LENGTH) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(trimmed)) {
        addError(errors, variable.name, ERROR_CODES.PATTERN, 'Value does not match pattern');
      }
    } catch {
      addError(errors, variable.name, ERROR_CODES.PATTERN, 'Invalid pattern');
    }
  }

  if (errors.length > EMPTY_LENGTH) {
    return { errors };
  }

  return { errors, value: escapeHtml(trimmed) };
}

function validateDateValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];

  if (isMissing(rawValue)) {
    if (variable.required) {
      addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
    }
    return { errors };
  }

  if (typeof rawValue === 'string') {
    if (rawValue.trim().length === EMPTY_LENGTH) {
      if (variable.required) {
        addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
      }
      return { errors };
    }
  }

  let dateValue: Date | null = null;

  if (rawValue instanceof Date) {
    dateValue = rawValue;
  } else if (typeof rawValue === 'string' || typeof rawValue === 'number') {
    dateValue = new Date(rawValue);
  } else {
    addError(errors, variable.name, ERROR_CODES.INVALID_TYPE, 'Value must be a date');
    return { errors };
  }

  if (Number.isNaN(dateValue.getTime())) {
    addError(errors, variable.name, ERROR_CODES.INVALID_DATE, 'Invalid date');
    return { errors };
  }

  return { errors, value: dateValue };
}

function validateNumberValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];

  if (isMissing(rawValue)) {
    if (variable.required) {
      addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
    }
    return { errors };
  }

  let numberValue: number;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed.length === EMPTY_LENGTH) {
      if (variable.required) {
        addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
      }
      return { errors };
    }
    numberValue = Number.parseFloat(trimmed);
  } else if (typeof rawValue === 'number') {
    numberValue = rawValue;
  } else {
    addError(errors, variable.name, ERROR_CODES.INVALID_TYPE, 'Value must be a number');
    return { errors };
  }

  if (!Number.isFinite(numberValue)) {
    addError(errors, variable.name, ERROR_CODES.INVALID_NUMBER, 'Invalid number');
    return { errors };
  }

  return { errors, value: numberValue };
}

function validateSelectValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];

  const trimmed = validateRequiredString(variable, rawValue, errors);
  if (!trimmed) {
    return { errors };
  }

  const allowed = new Set(variable.options.map((option) => option.value));
  if (!allowed.has(trimmed)) {
    addError(errors, variable.name, ERROR_CODES.INVALID_OPTION, 'Invalid option');
    return { errors };
  }

  return { errors, value: trimmed };
}

function validateMultiSelectValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];

  if (isMissing(rawValue)) {
    if (variable.required) {
      addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
    }
    return { errors };
  }

  if (!Array.isArray(rawValue)) {
    addError(errors, variable.name, ERROR_CODES.INVALID_TYPE, 'Value must be an array');
    return { errors };
  }

  if (rawValue.length === EMPTY_LENGTH) {
    if (variable.required) {
      addError(errors, variable.name, ERROR_CODES.REQUIRED, 'Value is required');
    }
    return { errors, value: [] };
  }

  const allowed = new Set(variable.options.map((option) => option.value));
  const sanitized: string[] = [];

  for (const item of rawValue) {
    if (typeof item !== 'string') {
      addError(errors, variable.name, ERROR_CODES.INVALID_TYPE, 'Value must be a string');
      return { errors };
    }

    const trimmed = item.trim();
    if (trimmed.length === EMPTY_LENGTH || !allowed.has(trimmed)) {
      addError(errors, variable.name, ERROR_CODES.INVALID_OPTION, 'Invalid option');
      return { errors };
    }

    sanitized.push(trimmed);
  }

  return { errors, value: sanitized };
}

function validatePhoneValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];

  const trimmed = validateRequiredString(variable, rawValue, errors);
  if (!trimmed) {
    return { errors };
  }

  if (!PHONE_REGEX.test(trimmed)) {
    addError(errors, variable.name, ERROR_CODES.INVALID_PHONE, 'Invalid phone number');
    return { errors };
  }

  return { errors, value: trimmed };
}

function validateEmailValue(variable: TemplateVariable, rawValue: unknown): FieldResult {
  const errors: ValidationError[] = [];

  const trimmed = validateRequiredString(variable, rawValue, errors);
  if (!trimmed) {
    return { errors };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    addError(errors, variable.name, ERROR_CODES.INVALID_EMAIL, 'Invalid email');
    return { errors };
  }

  return { errors, value: trimmed };
}

function validateVariable(variable: TemplateVariable, rawValue: unknown): FieldResult {
  switch (variable.type) {
    case 'STRING':
    case 'TEXT':
      return validateStringValue(variable, rawValue);
    case 'DATE':
      return validateDateValue(variable, rawValue);
    case 'NUMBER':
    case 'CURRENCY':
      return validateNumberValue(variable, rawValue);
    case 'SELECT':
      return validateSelectValue(variable, rawValue);
    case 'MULTISELECT':
      return validateMultiSelectValue(variable, rawValue);
    case 'PHONE':
      return validatePhoneValue(variable, rawValue);
    case 'EMAIL':
      return validateEmailValue(variable, rawValue);
    default:
      return {
        errors: [
          {
            field: variable.name,
            code: ERROR_CODES.INVALID_TYPE,
            message: 'Unsupported variable type'
          }
        ]
      };
  }
}

export function validateVariables(
  schema: TemplateVariable[],
  values: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const variable of schema) {
    const result = validateVariable(variable, values[variable.name]);
    errors.push(...result.errors);
    if (result.errors.length === EMPTY_LENGTH && result.value !== undefined) {
      sanitized[variable.name] = result.value;
    }
  }

  return {
    valid: errors.length === EMPTY_LENGTH,
    errors,
    sanitized
  };
}
