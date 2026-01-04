import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { PaginatedResponse, Template } from '@nyayamitra/shared';

import * as firebase from '../lib/firebase';
import * as typesense from '../lib/typesense';
import { handleError } from '../middleware/errorHandler';
import { templatesRouter } from './templates';

vi.mock('../lib/firebase', () => {
  return {
    templates: vi.fn()
  };
});

vi.mock('../lib/typesense', () => {
  return {
    searchTemplates: vi.fn()
  };
});

type TemplateSummary = Omit<Template, 'variables' | 'templateFileURL'>;

type FilterField = 'isActive' | 'categoryId';

type FilterValue = boolean | string;

interface QueryState {
  filters: Array<{ field: FilterField; value: FilterValue }>;
  offset: number;
  limit?: number;
}

interface QuerySnapshot<T> {
  docs: Array<{ id: string; data: () => T }>;
}

interface CountSnapshot {
  data: () => { count: number };
}

interface CountQuery {
  get: () => Promise<CountSnapshot>;
}

interface Query<T> {
  where: (field: FilterField, op: '==', value: FilterValue) => Query<T>;
  offset: (value: number) => Query<T>;
  limit: (value: number) => Query<T>;
  count: () => CountQuery;
  get: () => Promise<QuerySnapshot<T>>;
}

interface TemplatesCollection<T> {
  where: Query<T>['where'];
  doc: (id: string) => { get: () => Promise<{ exists: boolean; id: string; data: () => T | undefined }> };
}

function applyFilters(items: Template[], state: QueryState): Template[] {
  return items.filter((item) => {
    return state.filters.every((filter) => {
      if (filter.field === 'isActive') {
        return item.isActive === filter.value;
      }
      if (filter.field === 'categoryId') {
        return item.categoryId === filter.value;
      }
      return true;
    });
  });
}

function createTemplatesQuery(items: Template[], state: QueryState): Query<Template> {
  const query: Query<Template> = {
    where: (field, _op, value) => {
      return createTemplatesQuery(items, {
        ...state,
        filters: [...state.filters, { field, value }]
      });
    },
    offset: (value) => {
      return createTemplatesQuery(items, { ...state, offset: value });
    },
    limit: (value) => {
      return createTemplatesQuery(items, { ...state, limit: value });
    },
    count: () => {
      return {
        get: async () => ({
          data: () => ({ count: applyFilters(items, state).length })
        })
      };
    },
    get: async () => {
      let result = applyFilters(items, state);
      if (state.offset > 0) {
        result = result.slice(state.offset);
      }
      if (typeof state.limit === 'number') {
        result = result.slice(0, state.limit);
      }
      return {
        docs: result.map((item) => ({
          id: item.id,
          data: () => item
        }))
      };
    }
  };

  return query;
}

function createTemplatesCollection(items: Template[]): TemplatesCollection<Template> {
  const baseState: QueryState = { filters: [], offset: 0 };
  const baseQuery = createTemplatesQuery(items, baseState);
  return {
    where: baseQuery.where,
    doc: (id: string) => {
      return {
        get: async () => {
          const match = items.find((item) => item.id === id);
          return {
            exists: Boolean(match),
            id,
            data: () => match
          };
        }
      };
    }
  };
}

function createTemplate(overrides: Partial<Template>): Template {
  return {
    id: 'template-1',
    categoryId: 'cat-1',
    categoryName: 'Civil',
    name: 'Bail Application',
    slug: 'bail-application',
    description: 'Sample description',
    keywords: ['bail'],
    templateFileURL: 'templates/template-1.docx',
    variables: [],
    estimatedMinutes: 10,
    isActive: true,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function toSummary(template: Template): TemplateSummary {
  const { variables: _vars, templateFileURL: _file, ...rest } = template;
  return rest;
}

function createApp(): Hono {
  const app = new Hono();
  app.onError(handleError);
  app.route('/templates', templatesRouter);
  return app;
}

const mockTemplates = vi.mocked(firebase.templates);
const mockSearchTemplates = vi.mocked(typesense.searchTemplates);

describe('GET /templates', () => {
  it('uses Typesense when search is provided', async () => {
    const template = createTemplate({ id: 'template-2', name: 'Contract' });
    const summary = toSummary(template);

    mockSearchTemplates.mockResolvedValue({
      hits: [summary],
      total: 2,
      page: 2,
      limit: 1
    });

    const app = createApp();
    const response = await app.request('/templates?search=contract&categoryId=cat-1&page=2&limit=1');

    expect(response.status).toBe(200);
    expect(mockSearchTemplates).toHaveBeenCalledWith(
      'contract',
      'isActive:=true && categoryId:=cat-1',
      2,
      1
    );

    const body = (await response.json()) as PaginatedResponse<TemplateSummary>;
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.totalPages).toBe(2);
  });

  it('returns Firestore results when search is not provided', async () => {
    const items: Template[] = [
      createTemplate({ id: 'template-1', categoryId: 'cat-1', isActive: true }),
      createTemplate({ id: 'template-2', categoryId: 'cat-2', isActive: true }),
      createTemplate({ id: 'template-3', categoryId: 'cat-1', isActive: false })
    ];

    mockTemplates.mockImplementation(() => createTemplatesCollection(items));

    const app = createApp();
    const response = await app.request('/templates?categoryId=cat-1&page=1&limit=10');

    expect(response.status).toBe(200);

    const body = (await response.json()) as PaginatedResponse<TemplateSummary>;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe('template-1');
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.totalPages).toBe(1);
  });

  it('validates query params', async () => {
    const app = createApp();
    const response = await app.request('/templates?page=0');

    expect(response.status).toBe(400);
  });
});

describe('GET /templates/:id', () => {
  it('returns template by id', async () => {
    const items: Template[] = [createTemplate({ id: 'template-1', isActive: true })];

    mockTemplates.mockImplementation(() => createTemplatesCollection(items));

    const app = createApp();
    const response = await app.request('/templates/template-1');

    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: Template };
    expect(body.data.id).toBe('template-1');
  });

  it('returns 404 when template is missing', async () => {
    mockTemplates.mockImplementation(() => createTemplatesCollection([]));

    const app = createApp();
    const response = await app.request('/templates/missing');

    expect(response.status).toBe(404);
  });

  it('returns 404 when template is inactive', async () => {
    const items: Template[] = [createTemplate({ id: 'template-2', isActive: false })];

    mockTemplates.mockImplementation(() => createTemplatesCollection(items));

    const app = createApp();
    const response = await app.request('/templates/template-2');

    expect(response.status).toBe(404);
  });
});
