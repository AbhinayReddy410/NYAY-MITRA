import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { CollectionReference, DocumentReference, WriteResult } from 'firebase-admin/firestore';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DRAFT_LIMITS, ERROR_CODES } from '@nyayamitra/shared';
import type { Draft, Template, User, UserPlan } from '@nyayamitra/shared';

import * as firebase from '../lib/firebase';
import { handleError } from '../middleware/errorHandler';
import * as documentGenerator from '../services/documentGenerator';
import * as variableValidator from '../services/variableValidator';
import { createMockDecodedToken } from '../test/fixtures';
import {
  createMockCollectionReference,
  createMockDocumentReference,
  createMockDocumentSnapshot,
  createMockQuerySnapshot,
  createMockTransaction
} from '../test/mocks/firestore';
import { draftsRouter } from './drafts';

const authUser = createMockDecodedToken({
  uid: 'user-1',
  email: 'user@example.com',
  name: 'Test User'
});

const uuidValue = 'abcd1234efgh5678';

const httpStatus = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  paymentRequired: 402,
  notFound: 404
} as const;

vi.mock('node:crypto', () => {
  return {
    randomUUID: () => uuidValue
  };
});

vi.mock('../middleware/auth', () => {
  return {
    authMiddleware: () => {
      return async (c: Context, next: Next): Promise<Response | void> => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return c.json(
            {
              error: {
                code: ERROR_CODES.AUTH_REQUIRED,
                message: 'Authentication required'
              }
            },
            httpStatus.unauthorized
          );
        }
        c.set('user', authUser);
        await next();
      };
    }
  };
});

vi.mock('../lib/firebase', () => {
  return {
    db: {
      runTransaction: vi.fn()
    },
    users: vi.fn(),
    templates: vi.fn(),
    userDrafts: vi.fn(),
    getTemplateFile: vi.fn(),
    uploadDraft: vi.fn(),
    getSignedUrl: vi.fn()
  };
});

vi.mock('../services/variableValidator', () => {
  return {
    validateVariables: vi.fn()
  };
});

vi.mock('../services/documentGenerator', () => {
  return {
    generateDocument: vi.fn()
  };
});

const mockUsers = vi.mocked(firebase.users);
const mockTemplates = vi.mocked(firebase.templates);
const mockUserDrafts = vi.mocked(firebase.userDrafts);
const mockGetTemplateFile = vi.mocked(firebase.getTemplateFile);
const mockUploadDraft = vi.mocked(firebase.uploadDraft);
const mockGetSignedUrl = vi.mocked(firebase.getSignedUrl);
const mockRunTransaction = vi.mocked(firebase.db.runTransaction);
const mockValidateVariables = vi.mocked(variableValidator.validateVariables);
const mockGenerateDocument = vi.mocked(documentGenerator.generateDocument);

const HTTP_OK = httpStatus.ok;
const HTTP_BAD_REQUEST = httpStatus.badRequest;
const HTTP_UNAUTHORIZED = httpStatus.unauthorized;
const HTTP_PAYMENT_REQUIRED = httpStatus.paymentRequired;
const HTTP_NOT_FOUND = httpStatus.notFound;

const DEFAULT_PLAN: UserPlan = 'free';
const DEFAULT_DRAFTS_USED = 0;
const INCREMENT_STEP = 1;
const NO_LENGTH_LIMIT = 0;
const EMPTY_OFFSET = 0;
const DRAFT_LIMIT = DRAFT_LIMITS.free;
const DRAFT_ID_SUFFIX_LENGTH = 8;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60 * 1000;
const DRAFT_EXPIRY_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;
const NOW_ISO = '2026-03-10T10:00:00.000Z';
const TEMPLATE_ID = 'template-1';
const TEMPLATE_NAME = 'Bail Template';
const CATEGORY_NAME = 'Civil';
const DRAFT_URL = 'https://example.com/draft';
const REFRESHED_URL = 'https://example.com/refresh';
const VALIDATION_ERRORS = [{ field: 'name', message: 'Invalid', code: 'INVALID' }];
const DEFAULT_TEMPLATE_ORDER = 1;
const DEFAULT_TEMPLATE_MINUTES = 5;
const DEFAULT_USAGE_COUNT = 0;
const TOTAL_PAGES_SINGLE = 1;
const GENERATED_VARIABLE_COUNT = 1;

interface DraftQueryState {
  orderField?: 'createdAt';
  orderDirection?: 'asc' | 'desc';
  offset: number;
  limit?: number;
}

function createUsersCollection(store: Map<string, User>): CollectionReference<User> {
  return createMockCollectionReference<User>({
    doc: vi.fn((id?: string) => {
      const resolvedId = id ?? 'doc-id';
      const ref = createMockDocumentReference<User>(resolvedId);
      ref.get = vi.fn(async () => createMockDocumentSnapshot(store.has(resolvedId), store.get(resolvedId), resolvedId));
      ref.set = vi.fn(async (data: User) => {
        store.set(resolvedId, data);
        return {} as WriteResult;
      });
      ref.update = vi.fn(async (data: Partial<User>) => {
        const existing = store.get(resolvedId);
        if (!existing) {
          throw new Error('User not found');
        }
        store.set(resolvedId, { ...existing, ...data });
        return {} as WriteResult;
      }) as unknown as DocumentReference<User>['update'];
      return ref;
    })
  });
}

function createTemplatesCollection(store: Map<string, Template>): CollectionReference<Template> {
  return createMockCollectionReference<Template>({
    doc: vi.fn((id?: string) => {
      const resolvedId = id ?? 'doc-id';
      const ref = createMockDocumentReference<Template>(resolvedId);
      ref.get = vi.fn(async () =>
        createMockDocumentSnapshot(store.has(resolvedId), store.get(resolvedId), resolvedId)
      );
      return ref;
    })
  });
}

function createDraftsQuery(store: Map<string, Draft>, state: DraftQueryState): CollectionReference<Draft> {
  const query = createMockCollectionReference<Draft>({
    orderBy: vi.fn((field: 'createdAt', direction: 'asc' | 'desc') => {
      return createDraftsQuery(store, { ...state, orderField: field, orderDirection: direction });
    }),
    offset: vi.fn((value: number) => {
      return createDraftsQuery(store, { ...state, offset: value });
    }),
    limit: vi.fn((value: number) => {
      return createDraftsQuery(store, { ...state, limit: value });
    }),
    count: vi.fn(() => ({
      get: async () => ({
        data: () => ({ count: store.size })
      })
    })),
    get: vi.fn(async () => {
      let items = [...store.values()];
      if (state.orderField === 'createdAt') {
        items.sort((a, b) => {
          const left = Date.parse(a.createdAt);
          const right = Date.parse(b.createdAt);
          const delta = right - left;
          return state.orderDirection === 'asc' ? -delta : delta;
        });
      }
      if (state.offset > EMPTY_OFFSET) {
        items = items.slice(state.offset);
      }
      if (typeof state.limit === 'number') {
        items = items.slice(EMPTY_OFFSET, state.limit);
      }
      return createMockQuerySnapshot(items.map((draft) => ({ id: draft.id, data: draft })));
    })
  });

  return query;
}

function createDraftsCollection(store: Map<string, Draft>): CollectionReference<Draft> {
  const baseState: DraftQueryState = { offset: EMPTY_OFFSET };
  const baseQuery = createDraftsQuery(store, baseState);
  return createMockCollectionReference<Draft>({
    doc: vi.fn((id?: string) => {
      const resolvedId = id ?? 'doc-id';
      const ref = createMockDocumentReference<Draft>(resolvedId);
      ref.set = vi.fn(async (data: Draft) => {
        store.set(resolvedId, data);
        return {} as WriteResult;
      });
      ref.update = vi.fn(async (data: Partial<Draft>) => {
        const existing = store.get(resolvedId);
        if (!existing) {
          throw new Error('Draft not found');
        }
        store.set(resolvedId, { ...existing, ...data });
        return {} as WriteResult;
      }) as unknown as DocumentReference<Draft>['update'];
      return ref;
    }),
    orderBy: baseQuery.orderBy
  });
}

function createUser(overrides: Partial<User>): User {
  return {
    uid: authUser.uid,
    email: authUser.email ?? '',
    phone: '',
    displayName: authUser.name ?? '',
    plan: DEFAULT_PLAN,
    draftsUsedThisMonth: DEFAULT_DRAFTS_USED,
    draftsResetDate: '2026-03-01T00:00:00.000Z',
    subscriptionId: '',
    subscriptionStatus: 'none',
    createdAt: NOW_ISO,
    lastLoginAt: NOW_ISO,
    ...overrides
  };
}

function createTemplate(overrides: Partial<Template>): Template {
  return {
    id: TEMPLATE_ID,
    categoryId: 'cat-1',
    categoryName: CATEGORY_NAME,
    name: TEMPLATE_NAME,
    slug: 'bail-template',
    description: 'Template description',
    keywords: ['bail'],
    templateFileURL: 'templates/template-1.docx',
    variables: [
      {
        name: 'name',
        label: 'Name',
        type: 'STRING',
        required: true,
        maxLength: NO_LENGTH_LIMIT,
        minLength: NO_LENGTH_LIMIT,
        pattern: '',
        options: [],
        placeholder: '',
        helpText: '',
        section: 'default',
        order: DEFAULT_TEMPLATE_ORDER,
        defaultValue: null
      }
    ],
    estimatedMinutes: DEFAULT_TEMPLATE_MINUTES,
    isActive: true,
    usageCount: DEFAULT_USAGE_COUNT,
    createdAt: NOW_ISO,
    ...overrides
  };
}

function createDraft(overrides: Partial<Draft>): Draft {
  return {
    id: 'draft-1',
    userId: authUser.uid,
    templateId: TEMPLATE_ID,
    templateName: TEMPLATE_NAME,
    categoryName: CATEGORY_NAME,
    generatedFileURL: DRAFT_URL,
    variables: { name: 'Test' },
    createdAt: '2026-03-09T10:00:00.000Z',
    expiresAt: '2026-03-09T10:00:00.000Z',
    ...overrides
  };
}

function createApp(): Hono {
  const app = new Hono();
  app.onError(handleError);
  app.route('/drafts', draftsRouter);
  return app;
}

function setSystemTime(iso: string): Date {
  const now = new Date(iso);
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return now;
}

function buildDraftId(now: Date): string {
  return `${now.getTime()}-${uuidValue.slice(0, DRAFT_ID_SUFFIX_LENGTH)}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

function setupTransactionMock(): void {
  mockRunTransaction.mockImplementation(async (callback) => {
    const transaction = createMockTransaction();
    const mutableTransaction = transaction as unknown as Record<string, unknown>;
    mutableTransaction.get = vi.fn(async (ref: DocumentReference<User>) => ref.get());
    mutableTransaction.update = vi.fn((ref: DocumentReference<User>, data: Partial<User>) => {
      void ref.update(data);
      return transaction;
    });

    await callback(transaction);
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('POST /drafts', () => {
  it('creates a draft and returns download info', async () => {
    const now = setSystemTime(NOW_ISO);
    const usersStore = new Map<string, User>([[authUser.uid, createUser({})]]);
    const templatesStore = new Map<string, Template>([[TEMPLATE_ID, createTemplate({})]]);
    const draftsStore = new Map<string, Draft>();

    mockUsers.mockImplementation(() => createUsersCollection(usersStore));
    mockTemplates.mockImplementation(() => createTemplatesCollection(templatesStore));
    mockUserDrafts.mockImplementation(() => createDraftsCollection(draftsStore));
    mockGetTemplateFile.mockResolvedValue(Buffer.from('template'));
    mockUploadDraft.mockResolvedValue(DRAFT_URL);
    mockValidateVariables.mockReturnValue({
      valid: true,
      errors: [],
      sanitized: { name: 'Test' }
    });
    mockGenerateDocument.mockReturnValue({
      buffer: Buffer.from('generated'),
      metadata: { generatedAt: now, variableCount: GENERATED_VARIABLE_COUNT }
    });

    setupTransactionMock();

    const app = createApp();
    const response = await app.request('/drafts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templateId: TEMPLATE_ID, variables: { name: 'Test' } })
    });

    expect(response.status).toBe(HTTP_OK);

    const body = (await response.json()) as {
      data: { draftId: string; downloadUrl: string; expiresAt: string };
    };

    const expectedDraftId = buildDraftId(now);
    const expectedExpiresAt = addMinutes(now, DRAFT_EXPIRY_MINUTES).toISOString();

    expect(body.data.draftId).toBe(expectedDraftId);
    expect(body.data.downloadUrl).toBe(DRAFT_URL);
    expect(body.data.expiresAt).toBe(expectedExpiresAt);

    const storedDraft = draftsStore.get(expectedDraftId);
    expect(storedDraft?.generatedFileURL).toBe(DRAFT_URL);
    expect(storedDraft?.expiresAt).toBe(expectedExpiresAt);

    const updatedUser = usersStore.get(authUser.uid);
    expect(updatedUser?.draftsUsedThisMonth).toBe(DEFAULT_DRAFTS_USED + INCREMENT_STEP);
  });

  it('returns 402 when draft limit is exceeded', async () => {
    const usersStore = new Map<string, User>([[authUser.uid, createUser({ draftsUsedThisMonth: DRAFT_LIMIT })]]);

    mockUsers.mockImplementation(() => createUsersCollection(usersStore));
    setupTransactionMock();

    const app = createApp();
    const response = await app.request('/drafts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templateId: TEMPLATE_ID, variables: { name: 'Test' } })
    });

    expect(response.status).toBe(HTTP_PAYMENT_REQUIRED);

    const body = (await response.json()) as {
      error: { code: string; details: { used: number; limit: number } };
    };

    expect(body.error.code).toBe(ERROR_CODES.DRAFT_LIMIT_EXCEEDED);
    expect(body.error.details).toEqual({ used: DRAFT_LIMIT, limit: DRAFT_LIMIT });
  });

  it('returns 404 when template is missing', async () => {
    const usersStore = new Map<string, User>([[authUser.uid, createUser({})]]);
    const templatesStore = new Map<string, Template>();

    mockUsers.mockImplementation(() => createUsersCollection(usersStore));
    mockTemplates.mockImplementation(() => createTemplatesCollection(templatesStore));
    setupTransactionMock();

    const app = createApp();
    const response = await app.request('/drafts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templateId: TEMPLATE_ID, variables: { name: 'Test' } })
    });

    expect(response.status).toBe(HTTP_NOT_FOUND);
  });

  it('returns 400 when variables are invalid', async () => {
    const usersStore = new Map<string, User>([[authUser.uid, createUser({})]]);
    const templatesStore = new Map<string, Template>([[TEMPLATE_ID, createTemplate({})]]);

    mockUsers.mockImplementation(() => createUsersCollection(usersStore));
    mockTemplates.mockImplementation(() => createTemplatesCollection(templatesStore));
    mockValidateVariables.mockReturnValue({
      valid: false,
      errors: VALIDATION_ERRORS,
      sanitized: {}
    });
    setupTransactionMock();

    const app = createApp();
    const response = await app.request('/drafts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templateId: TEMPLATE_ID, variables: { name: 'Test' } })
    });

    expect(response.status).toBe(HTTP_BAD_REQUEST);

    const body = (await response.json()) as { error: { code: string; details: unknown } };
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.error.details).toEqual(VALIDATION_ERRORS);
  });
});

describe('GET /drafts/history', () => {
  it('returns paginated drafts and refreshes expired URLs', async () => {
    const now = setSystemTime(NOW_ISO);
    const draftsStore = new Map<string, Draft>([
      ['draft-1', createDraft({ id: 'draft-1', expiresAt: '2026-03-09T10:00:00.000Z' })],
      ['draft-2', createDraft({
        id: 'draft-2',
        createdAt: '2026-03-08T10:00:00.000Z',
        expiresAt: '2026-03-11T10:00:00.000Z'
      })]
    ]);

    mockUserDrafts.mockImplementation(() => createDraftsCollection(draftsStore));
    mockGetSignedUrl.mockResolvedValue(REFRESHED_URL);

    const app = createApp();
    const response = await app.request('/drafts/history', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(HTTP_OK);

    const body = (await response.json()) as {
      data: Draft[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };

    expect(body.pagination).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      total: draftsStore.size,
      totalPages: TOTAL_PAGES_SINGLE
    });

    expect(body.data[0]?.id).toBe('draft-1');
    expect(body.data[1]?.id).toBe('draft-2');

    const refreshedDraft = draftsStore.get('draft-1');
    const expectedExpiresAt = addMinutes(now, DRAFT_EXPIRY_MINUTES).toISOString();

    expect(refreshedDraft?.generatedFileURL).toBe(REFRESHED_URL);
    expect(refreshedDraft?.expiresAt).toBe(expectedExpiresAt);
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      `drafts/${authUser.uid}/draft-1.docx`,
      DRAFT_EXPIRY_MINUTES
    );
  });

  it('returns 401 without auth header', async () => {
    mockUserDrafts.mockImplementation(() => createDraftsCollection(new Map()));

    const app = createApp();
    const response = await app.request('/drafts/history');

    expect(response.status).toBe(HTTP_UNAUTHORIZED);
  });
});
