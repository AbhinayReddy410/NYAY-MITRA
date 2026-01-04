export type VariableType =
  | 'STRING'
  | 'TEXT'
  | 'DATE'
  | 'NUMBER'
  | 'CURRENCY'
  | 'SELECT'
  | 'MULTISELECT'
  | 'PHONE'
  | 'EMAIL';

export interface SelectOption {
  value: string;
  label: string;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: VariableType;
  required: boolean;
  maxLength: number;
  minLength: number;
  pattern: string;
  options: SelectOption[];
  placeholder: string;
  helpText: string;
  section: string;
  order: number;
  defaultValue: unknown;
}

export interface Template {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  templateFileURL: string;
  variables: TemplateVariable[];
  estimatedMinutes: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}
