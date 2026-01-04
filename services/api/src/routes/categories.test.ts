import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { Category } from '@nyayamitra/shared';

import { authRequired } from '../lib/errors';
import * as firebase from '../lib/firebase';
import { handleError } from '../middleware/errorHandler';
import { categoriesRouter } from './categories';

vi.mock('../middleware/auth', () => {
  return {
    authMiddleware: () => {
      return async (c, next): Promise<Response | void> => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw authRequired();
        }
        await next();
      };
    }
  };
});

vi.mock('../lib/firebase', () => {
  return {
    categories: vi.fn()
  };
});

interface QuerySnapshot<T> {
  docs: Array<{ id: string; data: () => T }>;
}

interface Query<T> {
  where: (field: string, op: '==', value: boolean) => Query<T>;
  orderBy: (field: string, direction: 'asc' | 'desc') => Query<T>;
  get: () => Promise<QuerySnapshot<T>>;
}

interface QueryState {
  filterField?: string;
  filterValue?: boolean;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
}

function createMockQuery(items: Category[]): Query<Category> {
  const state: QueryState = {};

  const query: Query<Category> = {
    where: (field, _op, value) => {
      state.filterField = field;
      state.filterValue = value;
      return query;
    },
    orderBy: (field, direction) => {
      state.orderField = field;
      state.orderDirection = direction;
      return query;
    },
    get: async () => {
      let result = [...items];

      if (state.filterField === 'isActive' && typeof state.filterValue === 'boolean') {
        result = result.filter((item) => item.isActive === state.filterValue);
      }

      if (state.orderField === 'order') {
        result.sort((a, b) => {
          const delta = a.order - b.order;
          return state.orderDirection === 'desc' ? -delta : delta;
        });
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

function createCategory(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    name: 'Civil',
    slug: 'civil',
    icon: 'scale',
    description: 'Civil law templates',
    order: 1,
    templateCount: 0,
    isActive: true,
    ...overrides
  };
}

function createApp(): Hono {
  const app = new Hono();
  app.onError(handleError);
  app.route('/categories', categoriesRouter);
  return app;
}

const mockCategories = vi.mocked(firebase.categories);

describe('GET /categories', () => {
  it('returns sorted categories', async () => {
    const items: Category[] = [
      createCategory({ id: 'cat-2', order: 2 }),
      createCategory({ id: 'cat-1', order: 1 })
    ];

    mockCategories.mockImplementation(() => createMockQuery(items));

    const app = createApp();
    const response = await app.request('/categories', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: Category[] };
    expect(body.data.map((item) => item.id)).toEqual(['cat-1', 'cat-2']);
  });

  it('filters inactive categories', async () => {
    const items: Category[] = [
      createCategory({ id: 'cat-1', isActive: true, order: 1 }),
      createCategory({ id: 'cat-2', isActive: false, order: 2 })
    ];

    mockCategories.mockImplementation(() => createMockQuery(items));

    const app = createApp();
    const response = await app.request('/categories', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: Category[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe('cat-1');
  });

  it('returns 401 without auth', async () => {
    const items: Category[] = [createCategory({ id: 'cat-1' })];
    mockCategories.mockImplementation(() => createMockQuery(items));

    const app = createApp();
    const response = await app.request('/categories');

    expect(response.status).toBe(401);

    const body = (await response.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});
