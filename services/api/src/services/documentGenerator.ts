import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { TemplateVariable } from '@nyayamitra/shared';

export interface DocumentGenerationMetadata {
  generatedAt: Date;
  variableCount: number;
}

export interface DocumentGenerationResult {
  buffer: Buffer;
  metadata: DocumentGenerationMetadata;
}

export interface GenerateDocumentOptions {
  templateBuffer: Buffer;
  variables: Record<string, unknown>;
  schema: TemplateVariable[];
}

export class DocumentGenerationError extends Error {
  public readonly cause?: unknown;

  public constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DocumentGenerationError';
    this.cause = cause;
    Object.setPrototypeOf(this, DocumentGenerationError.prototype);
  }
}

const DATE_SEPARATOR = '/';
const DATE_PAD_LENGTH = 2;
const MONTH_OFFSET = 1;
const PHONE_COUNTRY_CODE = '+91';
const PHONE_PREFIX_LENGTH = 5;
const PHONE_TOTAL_LENGTH = 10;
const MULTISELECT_SEPARATOR = ', ';
const NUMBER_FRACTION_DIGITS = 2;
const CURRENCY_FRACTION_DIGITS = 0;
const HTML_ENTITY_RUPEE = '₹';

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: NUMBER_FRACTION_DIGITS
});

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: CURRENCY_FRACTION_DIGITS
});

function padDatePart(value: number): string {
  return String(value).padStart(DATE_PAD_LENGTH, '0');
}

export function formatIndianDate(date: Date): string {
  const day = padDatePart(date.getUTCDate());
  const month = padDatePart(date.getUTCMonth() + MONTH_OFFSET);
  const year = date.getUTCFullYear();
  return `${day}${DATE_SEPARATOR}${month}${DATE_SEPARATOR}${year}`;
}

export function formatIndianCurrency(value: number): string {
  const formatted = currencyFormatter.format(value);
  if (formatted.startsWith(HTML_ENTITY_RUPEE)) {
    return formatted;
  }
  return `${HTML_ENTITY_RUPEE}${formatted}`;
}

export function formatIndianNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== PHONE_TOTAL_LENGTH) {
    return value;
  }

  const first = digits.slice(0, PHONE_PREFIX_LENGTH);
  const second = digits.slice(PHONE_PREFIX_LENGTH);
  return `${PHONE_COUNTRY_CODE} ${first} ${second}`;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatValue(type: TemplateVariable['type'], value: unknown): unknown {
  switch (type) {
    case 'DATE': {
      const date = parseDate(value);
      return date ? formatIndianDate(date) : value;
    }
    case 'CURRENCY': {
      const parsed = parseNumber(value);
      return parsed === null ? value : formatIndianCurrency(parsed);
    }
    case 'NUMBER': {
      const parsed = parseNumber(value);
      return parsed === null ? value : formatIndianNumber(parsed);
    }
    case 'PHONE': {
      if (typeof value !== 'string') {
        return value;
      }
      return formatPhone(value);
    }
    case 'MULTISELECT': {
      if (!Array.isArray(value)) {
        return value;
      }
      return value.map((item) => String(item)).join(MULTISELECT_SEPARATOR);
    }
    default:
      return value;
  }
}

function formatVariables(schema: TemplateVariable[], values: Record<string, unknown>): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};

  for (const variable of schema) {
    if (!(variable.name in values)) {
      continue;
    }

    const rawValue = values[variable.name];
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    formatted[variable.name] = formatValue(variable.type, rawValue);
  }

  return formatted;
}

export function generateDocument(options: GenerateDocumentOptions): DocumentGenerationResult {
  const formattedVariables = formatVariables(options.schema, options.variables);

  let doc: Docxtemplater;
  try {
    const zip = new PizZip(options.templateBuffer);
    doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  } catch (error) {
    throw new DocumentGenerationError('Failed to load template', error);
  }

  try {
    doc.setData(formattedVariables);
    doc.render();
  } catch (error) {
    throw new DocumentGenerationError('Document generation failed', error);
  }

  const buffer = doc.getZip().generate({ type: 'nodebuffer' });
  const metadata: DocumentGenerationMetadata = {
    generatedAt: new Date(),
    variableCount: Object.keys(formattedVariables).length
  };

  return { buffer, metadata };
}
