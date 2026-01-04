import { describe, expect, it } from 'vitest';

import type { SelectOption, TemplateVariable, VariableType } from '@nyayamitra/shared';

import { validateVariables } from './variableValidator';

const FIELD_NAME = 'field';
const DEFAULT_LABEL = 'Field';
const DEFAULT_SECTION = 'default';
const DEFAULT_ORDER = 1;
const DEFAULT_REQUIRED = true;
const DEFAULT_MAX_LENGTH = 0;
const DEFAULT_MIN_LENGTH = 0;
const EMPTY_PATTERN = '';
const EMPTY_STRING = '';
const SHORT_TEXT = 'x';
const VALID_TEXT = '  <b>Ok</b>  ';
const ESCAPED_TEXT = '&lt;b&gt;Ok&lt;/b&gt;';
const MIN_LENGTH = 2;
const MAX_LENGTH = 10;
const VALID_DATE = '2026-03-01';
const INVALID_DATE = 'invalid-date';
const VALID_NUMBER = '42.5';
const PARSED_NUMBER = 42.5;
const INVALID_NUMBER = 'not-a-number';
const VALID_CURRENCY = '1000';
const PARSED_CURRENCY = 1000;
const VALID_OPTION = 'opt-1';
const INVALID_OPTION = 'opt-x';
const VALID_PHONE = '9876543210';
const INVALID_PHONE = '12345';
const VALID_EMAIL = 'test@example.com';
const INVALID_EMAIL = 'bad-email';
const MULTI_OPTIONS = ['opt-2', 'opt-3'];

const ERROR_CODES = {
  MIN_LENGTH: 'MIN_LENGTH',
  PATTERN: 'PATTERN',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_NUMBER: 'INVALID_NUMBER',
  INVALID_OPTION: 'INVALID_OPTION',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_EMAIL: 'INVALID_EMAIL'
} as const;

function createVariable(type: VariableType, overrides: Partial<TemplateVariable> = {}): TemplateVariable {
  return {
    name: FIELD_NAME,
    label: DEFAULT_LABEL,
    type,
    required: DEFAULT_REQUIRED,
    maxLength: DEFAULT_MAX_LENGTH,
    minLength: DEFAULT_MIN_LENGTH,
    pattern: EMPTY_PATTERN,
    options: [],
    placeholder: EMPTY_STRING,
    helpText: EMPTY_STRING,
    section: DEFAULT_SECTION,
    order: DEFAULT_ORDER,
    defaultValue: null,
    ...overrides
  };
}

function createOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

describe('validateVariables', () => {
  it('validates STRING values', () => {
    const schema = [createVariable('STRING', { minLength: MIN_LENGTH, maxLength: MAX_LENGTH })];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_TEXT });
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    expect(validResult.sanitized[FIELD_NAME]).toBe(ESCAPED_TEXT);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: SHORT_TEXT });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.MIN_LENGTH);
  });

  it('validates TEXT values', () => {
    const schema = [createVariable('TEXT', { pattern: '^text$' })];

    const validResult = validateVariables(schema, { [FIELD_NAME]: 'text' });
    expect(validResult.valid).toBe(true);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: 'other' });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.PATTERN);
  });

  it('validates DATE values', () => {
    const schema = [createVariable('DATE')];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_DATE });
    expect(validResult.valid).toBe(true);
    expect(validResult.sanitized[FIELD_NAME]).toBeInstanceOf(Date);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: INVALID_DATE });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_DATE);
  });

  it('validates NUMBER values', () => {
    const schema = [createVariable('NUMBER')];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_NUMBER });
    expect(validResult.valid).toBe(true);
    expect(validResult.sanitized[FIELD_NAME]).toBe(PARSED_NUMBER);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: INVALID_NUMBER });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_NUMBER);
  });

  it('validates CURRENCY values', () => {
    const schema = [createVariable('CURRENCY')];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_CURRENCY });
    expect(validResult.valid).toBe(true);
    expect(validResult.sanitized[FIELD_NAME]).toBe(PARSED_CURRENCY);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: INVALID_NUMBER });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_NUMBER);
  });

  it('validates SELECT values', () => {
    const options = createOptions([VALID_OPTION, ...MULTI_OPTIONS]);
    const schema = [createVariable('SELECT', { options })];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_OPTION });
    expect(validResult.valid).toBe(true);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: INVALID_OPTION });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_OPTION);
  });

  it('validates MULTISELECT values', () => {
    const options = createOptions(MULTI_OPTIONS);
    const schema = [createVariable('MULTISELECT', { options })];

    const validResult = validateVariables(schema, { [FIELD_NAME]: MULTI_OPTIONS });
    expect(validResult.valid).toBe(true);
    expect(validResult.sanitized[FIELD_NAME]).toEqual(MULTI_OPTIONS);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: [INVALID_OPTION] });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_OPTION);
  });

  it('validates PHONE values', () => {
    const schema = [createVariable('PHONE')];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_PHONE });
    expect(validResult.valid).toBe(true);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: INVALID_PHONE });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_PHONE);
  });

  it('validates EMAIL values', () => {
    const schema = [createVariable('EMAIL')];

    const validResult = validateVariables(schema, { [FIELD_NAME]: VALID_EMAIL });
    expect(validResult.valid).toBe(true);

    const invalidResult = validateVariables(schema, { [FIELD_NAME]: INVALID_EMAIL });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]?.code).toBe(ERROR_CODES.INVALID_EMAIL);
  });
});
