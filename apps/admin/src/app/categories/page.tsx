'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Category } from '@nyayamitra/shared';

import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api';
import { firebaseAuth } from '../../lib/firebase';

const HEADER_TITLE = 'Categories';
const CREATE_LABEL = 'Create Category';
const TABLE_NAME_HEADER = 'Name';
const TABLE_SLUG_HEADER = 'Slug';
const TABLE_ACTIONS_HEADER = 'Actions';
const EDIT_LABEL = 'Edit';
const DELETE_LABEL = 'Delete';
const LOADING_MESSAGE = 'Loading categories...';
const ERROR_MESSAGE = 'Unable to load categories';
const EMPTY_MESSAGE = 'No categories found';
const MODAL_CREATE_TITLE = 'Create Category';
const MODAL_EDIT_TITLE = 'Edit Category';
const NAME_LABEL = 'Category Name';
const NAME_PLACEHOLDER = 'Enter category name';
const SLUG_LABEL = 'Slug';
const SLUG_PLACEHOLDER = 'Enter category slug';
const ICON_LABEL = 'Icon';
const ICON_PLACEHOLDER = 'Enter icon name';
const CANCEL_LABEL = 'Cancel';
const SAVE_LABEL = 'Save';
const SAVING_LABEL = 'Saving...';
const DELETE_CONFIRM_MESSAGE = 'Are you sure you want to delete this category?';
const DELETE_SUCCESS_MESSAGE = 'Category deleted successfully';
const DELETE_ERROR_MESSAGE = 'Failed to delete category';

type CategoryFormData = {
  name: string;
  slug: string;
  icon: string;
};

type ModalState = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  category: Category | null;
};

const INITIAL_FORM_DATA: CategoryFormData = {
  name: '',
  slug: '',
  icon: ''
};

const INITIAL_MODAL_STATE: ModalState = {
  isOpen: false,
  mode: 'create',
  category: null
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

async function createCategory(data: CategoryFormData): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  await apiClient.post('admin/categories', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    json: data
  });
}

async function updateCategory(categoryId: string, data: CategoryFormData): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  await apiClient.put(`admin/categories/${categoryId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    json: data
  });
}

async function deleteCategory(categoryId: string): Promise<void> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  await apiClient.delete(`admin/categories/${categoryId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export default function CategoriesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);
  const [formData, setFormData] = useState<CategoryFormData>(INITIAL_FORM_DATA);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalState(INITIAL_MODAL_STATE);
      setFormData(INITIAL_FORM_DATA);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: CategoryFormData }): Promise<void> =>
      updateCategory(categoryId, data),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalState(INITIAL_MODAL_STATE);
      setFormData(INITIAL_FORM_DATA);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });

  const handleOpenCreateModal = useCallback((): void => {
    setModalState({
      isOpen: true,
      mode: 'create',
      category: null
    });
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const handleOpenEditModal = useCallback((category: Category): void => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      category
    });
    setFormData({
      name: category.name,
      slug: category.slug,
      icon: category.icon ?? ''
    });
  }, []);

  const handleCloseModal = useCallback((): void => {
    setModalState(INITIAL_MODAL_STATE);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>): void => {
      e.preventDefault();

      if (modalState.mode === 'create') {
        createMutation.mutate(formData);
      } else if (modalState.category) {
        updateMutation.mutate({
          categoryId: modalState.category.id,
          data: formData
        });
      }
    },
    [modalState, formData, createMutation, updateMutation]
  );

  const handleDelete = useCallback(
    (categoryId: string): void => {
      if (window.confirm(DELETE_CONFIRM_MESSAGE)) {
        deleteMutation.mutate(categoryId);
      }
    },
    [deleteMutation]
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
          <Button onClick={handleOpenCreateModal}>{CREATE_LABEL}</Button>
        </div>

        <Card>
          {categoriesQuery.isLoading ? (
            <div className='py-8 text-center text-sm text-slate-600'>{LOADING_MESSAGE}</div>
          ) : categoriesQuery.error ? (
            <div className='py-8 text-center text-sm text-red-600'>{ERROR_MESSAGE}</div>
          ) : !categoriesQuery.data?.length ? (
            <div className='py-8 text-center text-sm text-slate-600'>{EMPTY_MESSAGE}</div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-slate-200'>
                    <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                      {TABLE_NAME_HEADER}
                    </th>
                    <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                      {TABLE_SLUG_HEADER}
                    </th>
                    <th className='pb-3 text-right text-sm font-medium text-slate-600'>
                      {TABLE_ACTIONS_HEADER}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesQuery.data.map((category) => (
                    <tr className='border-b border-slate-100' key={category.id}>
                      <td className='py-4 text-sm text-slate-900'>{category.name}</td>
                      <td className='py-4 text-sm text-slate-600'>{category.slug}</td>
                      <td className='py-4 text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button onClick={(): void => handleOpenEditModal(category)} variant='ghost'>
                            {EDIT_LABEL}
                          </Button>
                          <Button onClick={(): void => handleDelete(category.id)} variant='ghost'>
                            {DELETE_LABEL}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {modalState.isOpen ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40'>
          <Card className='mx-4 w-full max-w-md'>
            <h2 className='mb-6 text-xl font-semibold text-slate-900'>
              {modalState.mode === 'create' ? MODAL_CREATE_TITLE : MODAL_EDIT_TITLE}
            </h2>

            <form onSubmit={handleSubmit}>
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
                  <label className='block text-sm font-medium text-slate-700' htmlFor='slug'>
                    {SLUG_LABEL}
                  </label>
                  <Input
                    className='mt-1'
                    id='slug'
                    onChange={(e): void => setFormData({ ...formData, slug: e.target.value })}
                    placeholder={SLUG_PLACEHOLDER}
                    type='text'
                    value={formData.slug}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700' htmlFor='icon'>
                    {ICON_LABEL}
                  </label>
                  <Input
                    className='mt-1'
                    id='icon'
                    onChange={(e): void => setFormData({ ...formData, icon: e.target.value })}
                    placeholder={ICON_PLACEHOLDER}
                    type='text'
                    value={formData.icon}
                  />
                </div>

                <div className='flex justify-end gap-2 pt-4'>
                  <Button onClick={handleCloseModal} type='button' variant='secondary'>
                    {CANCEL_LABEL}
                  </Button>
                  <Button disabled={isSubmitting} type='submit'>
                    {isSubmitting ? SAVING_LABEL : SAVE_LABEL}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </AdminLayout>
  );
}
