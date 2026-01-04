'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { Category, TemplateVariable } from '@nyayamitra/shared';

import { AdminLayout } from '../../../components/AdminLayout';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { apiClient } from '../../../lib/api';
import { firebaseAuth } from '../../../lib/firebase';

const HEADER_TITLE = 'Create Template';
const BACK_LABEL = 'Back';
const UPLOAD_LABEL = 'Upload Template';
const UPLOAD_HELPER = 'Click to upload or drag and drop';
const UPLOAD_ACCEPT = 'DOCX files only';
const NAME_LABEL = 'Template Name';
const NAME_PLACEHOLDER = 'Enter template name';
const DESCRIPTION_LABEL = 'Description';
const DESCRIPTION_PLACEHOLDER = 'Enter template description';
const CATEGORY_LABEL = 'Category';
const CATEGORY_PLACEHOLDER = 'Select a category';
const VARIABLES_TITLE = 'Parsed Variables';
const NO_VARIABLES_MESSAGE = 'No variables detected in the template';
const VARIABLE_NAME_HEADER = 'Variable Name';
const VARIABLE_TYPE_HEADER = 'Type';
const VARIABLE_LABEL_HEADER = 'Label';
const VARIABLE_REQUIRED_HEADER = 'Required';
const CREATE_LABEL = 'Create Template';
const CREATING_LABEL = 'Creating...';
const FILE_REQUIRED_MESSAGE = 'Please upload a template file';
const NAME_REQUIRED_MESSAGE = 'Please enter a template name';
const CATEGORY_REQUIRED_MESSAGE = 'Please select a category';
const SUCCESS_MESSAGE = 'Template created successfully';
const ERROR_MESSAGE = 'Failed to create template';
const TEMPLATES_PATH = '/templates';

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
const DEFAULT_VARIABLE_TYPE = 'STRING';

type ParsedVariable = {
  name: string;
  type: string;
  label: string;
  required: boolean;
};

async function fetchCategories(): Promise<Category[]> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  const response = await apiClient
    .get('categories', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<{ data: Category[] }>();

  return response.data;
}

function extractVariablesFromDocx(file: File): Promise<string[]> {
  return new Promise((resolve, reject): void => {
    const reader = new FileReader();

    reader.onload = (e): void => {
      try {
        const content = e.target?.result;
        if (!content) {
          resolve([]);
          return;
        }

        const zip = new PizZip(content as ArrayBuffer);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true
        });

        const text = doc.getFullText();
        const matches = text.match(VARIABLE_PATTERN);

        if (!matches) {
          resolve([]);
          return;
        }

        const variables = matches.map((match): string => {
          return match.replace(/\{\{|\}\}/g, '').trim();
        });

        const uniqueVariables = Array.from(new Set(variables));
        resolve(uniqueVariables);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (): void => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export default function NewTemplatePage(): JSX.Element {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [variables, setVariables] = useState<ParsedVariable[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setError('');

    try {
      const extractedVariables = await extractVariablesFromDocx(selectedFile);
      const parsedVariables: ParsedVariable[] = extractedVariables.map((varName): ParsedVariable => {
        const cleanName = varName.replace(/[^a-zA-Z0-9_]/g, '_');
        const label = varName
          .split('_')
          .map((word): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        return {
          name: cleanName,
          type: DEFAULT_VARIABLE_TYPE,
          label,
          required: true
        };
      });

      setVariables(parsedVariables);
    } catch {
      setError('Failed to parse template file');
    }
  }, []);

  const handleVariableChange = useCallback(
    (index: number, field: keyof ParsedVariable, value: string | boolean): void => {
      setVariables((prev) =>
        prev.map((v, i): ParsedVariable => (i === index ? { ...v, [field]: value } : v))
      );
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();

      if (!file) {
        setError(FILE_REQUIRED_MESSAGE);
        return;
      }

      if (!name.trim()) {
        setError(NAME_REQUIRED_MESSAGE);
        return;
      }

      if (!categoryId) {
        setError(CATEGORY_REQUIRED_MESSAGE);
        return;
      }

      setIsSubmitting(true);
      setError('');

      try {
        const currentUser = firebaseAuth.currentUser;
        if (!currentUser) {
          throw new Error('Not authenticated');
        }

        const token = await currentUser.getIdToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name.trim());
        formData.append('description', description.trim());
        formData.append('categoryId', categoryId);
        formData.append('variables', JSON.stringify(variables));

        await apiClient.post('admin/templates', {
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        router.push(TEMPLATES_PATH);
      } catch {
        setError(ERROR_MESSAGE);
      } finally {
        setIsSubmitting(false);
      }
    },
    [file, name, description, categoryId, variables, router]
  );

  return (
    <AdminLayout>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
          <Button onClick={(): void => router.back()} variant='ghost'>
            {BACK_LABEL}
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className='space-y-6'>
            <Card>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-slate-700'>{UPLOAD_LABEL}</label>
                  <div className='mt-2'>
                    <input
                      accept='.docx'
                      className='block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800'
                      onChange={handleFileChange}
                      type='file'
                    />
                    <p className='mt-1 text-xs text-slate-500'>{UPLOAD_HELPER}</p>
                    <p className='text-xs text-slate-500'>{UPLOAD_ACCEPT}</p>
                  </div>
                  {file ? (
                    <p className='mt-2 text-sm text-slate-900'>Selected: {file.name}</p>
                  ) : null}
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700' htmlFor='name'>
                    {NAME_LABEL}
                  </label>
                  <Input
                    className='mt-1'
                    id='name'
                    onChange={(e): void => setName(e.target.value)}
                    placeholder={NAME_PLACEHOLDER}
                    type='text'
                    value={name}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700' htmlFor='description'>
                    {DESCRIPTION_LABEL}
                  </label>
                  <textarea
                    className='mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none'
                    id='description'
                    onChange={(e): void => setDescription(e.target.value)}
                    placeholder={DESCRIPTION_PLACEHOLDER}
                    rows={3}
                    value={description}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700' htmlFor='category'>
                    {CATEGORY_LABEL}
                  </label>
                  <select
                    className='mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none'
                    id='category'
                    onChange={(e): void => setCategoryId(e.target.value)}
                    value={categoryId}
                  >
                    <option value=''>{CATEGORY_PLACEHOLDER}</option>
                    {categoriesQuery.data?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {variables.length > 0 ? (
              <Card>
                <h2 className='mb-4 text-lg font-semibold text-slate-900'>{VARIABLES_TITLE}</h2>
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead>
                      <tr className='border-b border-slate-200'>
                        <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                          {VARIABLE_NAME_HEADER}
                        </th>
                        <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                          {VARIABLE_TYPE_HEADER}
                        </th>
                        <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                          {VARIABLE_LABEL_HEADER}
                        </th>
                        <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                          {VARIABLE_REQUIRED_HEADER}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {variables.map((variable, index) => (
                        <tr className='border-b border-slate-100' key={variable.name}>
                          <td className='py-3 text-sm text-slate-900'>{variable.name}</td>
                          <td className='py-3'>
                            <select
                              className='rounded-lg border border-slate-200 px-3 py-1 text-sm'
                              onChange={(e): void =>
                                handleVariableChange(index, 'type', e.target.value)
                              }
                              value={variable.type}
                            >
                              <option value='STRING'>String</option>
                              <option value='TEXT'>Text</option>
                              <option value='NUMBER'>Number</option>
                              <option value='DATE'>Date</option>
                              <option value='EMAIL'>Email</option>
                              <option value='PHONE'>Phone</option>
                              <option value='CURRENCY'>Currency</option>
                              <option value='SELECT'>Select</option>
                            </select>
                          </td>
                          <td className='py-3'>
                            <Input
                              onChange={(e): void =>
                                handleVariableChange(index, 'label', e.target.value)
                              }
                              type='text'
                              value={variable.label}
                            />
                          </td>
                          <td className='py-3'>
                            <input
                              checked={variable.required}
                              className='h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900'
                              onChange={(e): void =>
                                handleVariableChange(index, 'required', e.target.checked)
                              }
                              type='checkbox'
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : file ? (
              <Card>
                <p className='text-center text-sm text-slate-600'>{NO_VARIABLES_MESSAGE}</p>
              </Card>
            ) : null}

            {error ? (
              <div className='rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600'>{error}</div>
            ) : null}

            <div className='flex justify-end'>
              <Button disabled={isSubmitting} type='submit'>
                {isSubmitting ? CREATING_LABEL : CREATE_LABEL}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
