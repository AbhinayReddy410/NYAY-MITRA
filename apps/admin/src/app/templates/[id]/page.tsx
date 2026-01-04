'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Category, Template } from '@nyayamitra/shared';

import { AdminLayout } from '../../../components/AdminLayout';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { apiClient } from '../../../lib/api';
import { getCurrentUserToken } from '../../../lib/firebase';

const HEADER_TITLE = 'Edit Template';
const BACK_LABEL = 'Back';
const NAME_LABEL = 'Template Name';
const NAME_PLACEHOLDER = 'Enter template name';
const DESCRIPTION_LABEL = 'Description';
const DESCRIPTION_PLACEHOLDER = 'Enter template description';
const CATEGORY_LABEL = 'Category';
const CATEGORY_PLACEHOLDER = 'Select a category';
const STATUS_LABEL = 'Status';
const ACTIVE_LABEL = 'Active';
const INACTIVE_LABEL = 'Inactive';
const REPLACE_FILE_LABEL = 'Replace Template File';
const REPLACE_FILE_HELPER = 'Upload a new .docx file to replace the existing template';
const SAVE_LABEL = 'Save Changes';
const SAVING_LABEL = 'Saving...';
const DEACTIVATE_LABEL = 'Deactivate';
const ACTIVATE_LABEL = 'Activate';
const DEACTIVATING_LABEL = 'Deactivating...';
const ACTIVATING_LABEL = 'Activating...';
const LOADING_MESSAGE = 'Loading template...';
const ERROR_MESSAGE = 'Failed to load template';
const SAVE_SUCCESS_MESSAGE = 'Template updated successfully';
const SAVE_ERROR_MESSAGE = 'Failed to update template';
const TEMPLATES_PATH = '/templates';

type TemplateFormData = {
  name: string;
  description: string;
  categoryId: string;
  isActive: boolean;
};

async function fetchTemplate(templateId: string): Promise<Template> {
  const token = await getCurrentUserToken();
  const response = await apiClient
    .get(`admin/templates/${templateId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<{ data: Template }>();

  return response.data;
}

async function fetchCategories(): Promise<Category[]> {
  const token = await getCurrentUserToken();
  const response = await apiClient
    .get('categories', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<{ data: Category[] }>();

  return response.data;
}

async function updateTemplate(templateId: string, data: TemplateFormData, file?: File): Promise<void> {
  const token = await getCurrentUserToken();

  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);
    formData.append('description', data.description);
    formData.append('categoryId', data.categoryId);
    formData.append('isActive', data.isActive.toString());

    await apiClient.put(`admin/templates/${templateId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
  } else {
    await apiClient.put(`admin/templates/${templateId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      json: data
    });
  }
}

export default function EditTemplatePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const templateId = params.id as string;

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    categoryId: '',
    isActive: true
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const templateQuery = useQuery({
    queryKey: ['admin', 'template', templateId],
    queryFn: (): Promise<Template> => fetchTemplate(templateId)
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });

  useEffect((): void => {
    if (templateQuery.data) {
      setFormData({
        name: templateQuery.data.name,
        description: templateQuery.data.description ?? '',
        categoryId: templateQuery.data.categoryId,
        isActive: templateQuery.data.isActive
      });
    }
  }, [templateQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (data: TemplateFormData): Promise<void> => updateTemplate(templateId, data, file ?? undefined),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'template', templateId] });
      router.push(TEMPLATES_PATH);
    },
    onError: (): void => {
      setError(SAVE_ERROR_MESSAGE);
    }
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      setError('');
      updateMutation.mutate(formData);
    },
    [formData, updateMutation]
  );

  const handleToggleActive = useCallback((): void => {
    const newData = { ...formData, isActive: !formData.isActive };
    setFormData(newData);
    updateMutation.mutate(newData);
  }, [formData, updateMutation]);

  if (templateQuery.isLoading) {
    return (
      <AdminLayout>
        <div className='py-8 text-center text-sm text-slate-600'>{LOADING_MESSAGE}</div>
      </AdminLayout>
    );
  }

  if (templateQuery.error) {
    return (
      <AdminLayout>
        <div className='py-8 text-center text-sm text-red-600'>{ERROR_MESSAGE}</div>
      </AdminLayout>
    );
  }

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
                  <label className='block text-sm font-medium text-slate-700' htmlFor='name'>
                    {NAME_LABEL}
                  </label>
                  <Input
                    className='mt-1'
                    id='name'
                    onChange={(e): void => setFormData({ ...formData, name: e.target.value })}
                    placeholder={NAME_PLACEHOLDER}
                    type='text'
                    value={formData.name}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700' htmlFor='description'>
                    {DESCRIPTION_LABEL}
                  </label>
                  <textarea
                    className='mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none'
                    id='description'
                    onChange={(e): void => setFormData({ ...formData, description: e.target.value })}
                    placeholder={DESCRIPTION_PLACEHOLDER}
                    rows={3}
                    value={formData.description}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700' htmlFor='category'>
                    {CATEGORY_LABEL}
                  </label>
                  <select
                    className='mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none'
                    id='category'
                    onChange={(e): void => setFormData({ ...formData, categoryId: e.target.value })}
                    value={formData.categoryId}
                  >
                    <option value=''>{CATEGORY_PLACEHOLDER}</option>
                    {categoriesQuery.data?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700'>{STATUS_LABEL}</label>
                  <div className='mt-2'>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        formData.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {formData.isActive ? ACTIVE_LABEL : INACTIVE_LABEL}
                    </span>
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700'>{REPLACE_FILE_LABEL}</label>
                  <div className='mt-2'>
                    <input
                      accept='.docx'
                      className='block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800'
                      onChange={handleFileChange}
                      type='file'
                    />
                    <p className='mt-1 text-xs text-slate-500'>{REPLACE_FILE_HELPER}</p>
                  </div>
                  {file ? (
                    <p className='mt-2 text-sm text-slate-900'>New file: {file.name}</p>
                  ) : null}
                </div>
              </div>
            </Card>

            {error ? (
              <div className='rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600'>{error}</div>
            ) : null}

            <div className='flex justify-between'>
              <Button
                disabled={updateMutation.isPending}
                onClick={handleToggleActive}
                type='button'
                variant='secondary'
              >
                {updateMutation.isPending
                  ? formData.isActive
                    ? DEACTIVATING_LABEL
                    : ACTIVATING_LABEL
                  : formData.isActive
                    ? DEACTIVATE_LABEL
                    : ACTIVATE_LABEL}
              </Button>
              <Button disabled={updateMutation.isPending} type='submit'>
                {updateMutation.isPending ? SAVING_LABEL : SAVE_LABEL}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
