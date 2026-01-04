import { describe, expect, it, vi } from 'vitest';

import type { TemplateVariable, VariableType } from '@nyayamitra/shared';

import { DocumentGenerationError, generateDocument } from './documentGenerator';

const mocks = vi.hoisted(() => {
  const setData = vi.fn();
  const render = vi.fn();
  const generate = vi.fn().mockReturnValue(Buffer.from('generated'));
  const getZip = vi.fn().mockReturnValue({ generate });
  const Docxtemplater = vi.fn(function DocxtemplaterMock() {
    return {
      setData,
      render,
      getZip
    };
  });
  const PizZip = vi.fn(function PizZipMock() {
    return {};
  });

  return {
    setData,
    render,
    generate,
    Docxtemplater,
    PizZip
  };
});

vi.mock('docxtemplater', () => ({
  default: mocks.Docxtemplater
}));

vi.mock('pizzip', () => ({
  default: mocks.PizZip
}));

const FIELD_SECTION = 'default';
const DEFAULT_LABEL = 'Label';
const DEFAULT_ORDER = 1;
const EMPTY_STRING = '';
const DATE_VALUE = '2026-03-01';
const EXPECTED_DATE = '01/03/2026';
const CURRENCY_VALUE = 100000;
const EXPECTED_CURRENCY = '₹1,00,000';
const NUMBER_VALUE = 100000;
const EXPECTED_NUMBER = '1,00,000';
const PHONE_VALUE = '9876543210';
const EXPECTED_PHONE = '+91 98765 43210';
const MULTISELECT_VALUES = ['opt-1', 'opt-2'];
const EXPECTED_MULTISELECT = 'opt-1, opt-2';
const STRING_VALUE = 'Some text';

function createVariable(type: VariableType, name: string): TemplateVariable {
  return {
    name,
    label: DEFAULT_LABEL,
    type,
    required: true,
    maxLength: 0,
    minLength: 0,
    pattern: EMPTY_STRING,
    options: [],
    placeholder: EMPTY_STRING,
    helpText: EMPTY_STRING,
    section: FIELD_SECTION,
    order: DEFAULT_ORDER,
    defaultValue: null
  };
}

describe('generateDocument', () => {
  it('formats variables and returns metadata', () => {
    const schema: TemplateVariable[] = [
      createVariable('DATE', 'dateField'),
      createVariable('CURRENCY', 'currencyField'),
      createVariable('NUMBER', 'numberField'),
      createVariable('PHONE', 'phoneField'),
      createVariable('MULTISELECT', 'multiField'),
      createVariable('STRING', 'textField')
    ];

    const result = generateDocument({
      templateBuffer: Buffer.from('template'),
      variables: {
        dateField: DATE_VALUE,
        currencyField: CURRENCY_VALUE,
        numberField: NUMBER_VALUE,
        phoneField: PHONE_VALUE,
        multiField: MULTISELECT_VALUES,
        textField: STRING_VALUE,
        extraField: 'ignored'
      },
      schema
    });

    expect(result.buffer).toEqual(Buffer.from('generated'));
    expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    expect(result.metadata.variableCount).toBe(schema.length);

    expect(mocks.setData).toHaveBeenCalledWith({
      dateField: EXPECTED_DATE,
      currencyField: EXPECTED_CURRENCY,
      numberField: EXPECTED_NUMBER,
      phoneField: EXPECTED_PHONE,
      multiField: EXPECTED_MULTISELECT,
      textField: STRING_VALUE
    });
  });

  it('throws DocumentGenerationError when rendering fails', () => {
    mocks.render.mockImplementationOnce(() => {
      throw new Error('render failed');
    });

    const schema: TemplateVariable[] = [createVariable('STRING', 'textField')];

    expect(() => {
      generateDocument({
        templateBuffer: Buffer.from('template'),
        variables: { textField: STRING_VALUE },
        schema
      });
    }).toThrow(DocumentGenerationError);
  });
});
