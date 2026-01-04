import { Hono } from 'hono';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DRAFT_LIMITS } from '@nyayamitra/shared';
import type { User, UserPlan } from '@nyayamitra/shared';

import * as firebase from '../lib/firebase';
import { handleError } from '../middleware/errorHandler';
import { userRouter } from './user';

const authUser = vi.hoisted(() => {
  return {
    uid: 'user-1',
    email: 'user@example.com',
    phone_number: '+911234567890',
    name: 'Test User'
  } as DecodedIdToken;
});

const httpStatus = vi.hoisted(() => {
  return {
    ok: 200,
    unauthorized: 401
  };
});

vi.mock('../middleware/auth', () => {
  return {
    authMiddleware: () => {
      return async (c, next): Promise<Response | void> => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return c.json(
            {
              error: {
                code: 'AUTH_REQUIRED',
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
    users: vi.fn()
  };
});

const mockUsers = vi.mocked(firebase.users);

const DEFAULT_PLAN: UserPlan = 'free';
const PRO_PLAN: UserPlan = 'pro';
const DEFAULT_DRAFTS_USED = 0;
const UPDATED_DRAFTS_USED = 3;
const RESET_DRAFTS_USED = 5;
const HTTP_OK = httpStatus.ok;
const HTTP_UNAUTHORIZED = httpStatus.unauthorized;
const FIRST_DAY_OF_MONTH = 1;
const NEXT_MONTH_OFFSET = 1;

interface UserSnapshot {
  exists: boolean;
  id: string;
  data: () => User | undefined;
}

interface UserDocRef {
  get: () => Promise<UserSnapshot>;
  set: (data: User) => Promise<void>;
  update: (data: Partial<User>) => Promise<void>;
}

interface UsersCollection {
  doc: (id: string) => UserDocRef;
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), FIRST_DAY_OF_MONTH));
}

function nextMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + NEXT_MONTH_OFFSET, FIRST_DAY_OF_MONTH));
}

function createUsersCollection(store: Map<string, User>): UsersCollection {
  return {
    doc: (id: string) => {
      return {
        get: async () => ({
          exists: store.has(id),
          id,
          data: () => store.get(id)
        }),
        set: async (data: User) => {
          store.set(id, data);
        },
        update: async (data: Partial<User>) => {
          const existing = store.get(id);
          if (!existing) {
            throw new Error('User not found');
          }
          store.set(id, { ...existing, ...data });
        }
      };
    }
  };
}

function createUser(overrides: Partial<User>): User {
  return {
    uid: authUser.uid,
    email: authUser.email ?? '',
    phone: authUser.phone_number ?? '',
    displayName: authUser.name ?? '',
    plan: DEFAULT_PLAN,
    draftsUsedThisMonth: DEFAULT_DRAFTS_USED,
    draftsResetDate: '2026-01-01T00:00:00.000Z',
    subscriptionId: '',
    subscriptionStatus: 'none',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  };
}

function createApp(): Hono {
  const app = new Hono();
  app.onError(handleError);
  app.route('/user', userRouter);
  return app;
}

function setSystemTime(iso: string): Date {
  const now = new Date(iso);
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return now;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('GET /user/profile', () => {
  it('creates a new user with defaults and returns drafts limit', async () => {
    const now = setSystemTime('2026-01-15T12:00:00.000Z');
    const store = new Map<string, User>();
    mockUsers.mockImplementation(() => createUsersCollection(store));

    const app = createApp();
    const response = await app.request('/user/profile', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(HTTP_OK);

    const body = (await response.json()) as { data: User & { draftsLimit: number } };
    expect(body.data.uid).toBe(authUser.uid);
    expect(body.data.plan).toBe(DEFAULT_PLAN);
    expect(body.data.draftsUsedThisMonth).toBe(DEFAULT_DRAFTS_USED);
    expect(body.data.draftsLimit).toBe(DRAFT_LIMITS.free);
    expect(body.data.draftsResetDate).toBe(startOfMonthUtc(now).toISOString());

    const stored = store.get(authUser.uid);
    expect(stored?.lastLoginAt).toBe(now.toISOString());
  });

  it('updates lastLoginAt for existing users', async () => {
    const now = setSystemTime('2026-01-20T10:00:00.000Z');
    const store = new Map<string, User>([[authUser.uid, createUser({ lastLoginAt: '2026-01-01T00:00:00.000Z' })]]);
    mockUsers.mockImplementation(() => createUsersCollection(store));

    const app = createApp();
    const response = await app.request('/user/profile', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(HTTP_OK);

    const stored = store.get(authUser.uid);
    expect(stored?.lastLoginAt).toBe(now.toISOString());
  });
});

describe('PATCH /user/profile', () => {
  it('updates displayName only', async () => {
    setSystemTime('2026-01-20T10:00:00.000Z');
    const store = new Map<string, User>([[authUser.uid, createUser({ displayName: 'Old Name' })]]);
    mockUsers.mockImplementation(() => createUsersCollection(store));

    const app = createApp();
    const response = await app.request('/user/profile', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ displayName: 'New Name' })
    });

    expect(response.status).toBe(HTTP_OK);

    const body = (await response.json()) as { data: User };
    expect(body.data.displayName).toBe('New Name');

    const stored = store.get(authUser.uid);
    expect(stored?.displayName).toBe('New Name');
  });
});

describe('GET /user/subscription', () => {
  it('resets drafts usage when a new month starts', async () => {
    const now = setSystemTime('2026-02-15T08:00:00.000Z');
    const store = new Map<string, User>([[
      authUser.uid,
      createUser({
        plan: PRO_PLAN,
        draftsUsedThisMonth: RESET_DRAFTS_USED,
        draftsResetDate: '2026-01-01T00:00:00.000Z'
      })
    ]]);
    mockUsers.mockImplementation(() => createUsersCollection(store));

    const app = createApp();
    const response = await app.request('/user/subscription', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(HTTP_OK);

    const body = (await response.json()) as {
      data: {
        draftsUsedThisMonth: number;
        draftsLimit: number;
        currentPeriodEnd: string;
      };
    };

    const periodStart = startOfMonthUtc(now);
    const nextPeriodStart = nextMonthStartUtc(periodStart);

    expect(body.data.draftsUsedThisMonth).toBe(DEFAULT_DRAFTS_USED);
    expect(body.data.draftsLimit).toBe(DRAFT_LIMITS.pro);
    expect(body.data.currentPeriodEnd).toBe(nextPeriodStart.toISOString());

    const stored = store.get(authUser.uid);
    expect(stored?.draftsUsedThisMonth).toBe(DEFAULT_DRAFTS_USED);
    expect(stored?.draftsResetDate).toBe(periodStart.toISOString());
  });

  it('keeps drafts usage within the current month', async () => {
    const now = setSystemTime('2026-02-15T08:00:00.000Z');
    const store = new Map<string, User>([[
      authUser.uid,
      createUser({
        draftsUsedThisMonth: UPDATED_DRAFTS_USED,
        draftsResetDate: '2026-02-01T00:00:00.000Z'
      })
    ]]);
    mockUsers.mockImplementation(() => createUsersCollection(store));

    const app = createApp();
    const response = await app.request('/user/subscription', {
      headers: { Authorization: 'Bearer token' }
    });

    expect(response.status).toBe(HTTP_OK);

    const body = (await response.json()) as {
      data: {
        draftsUsedThisMonth: number;
        draftsLimit: number;
        currentPeriodEnd: string;
      };
    };

    const periodStart = startOfMonthUtc(now);
    const nextPeriodStart = nextMonthStartUtc(periodStart);

    expect(body.data.draftsUsedThisMonth).toBe(UPDATED_DRAFTS_USED);
    expect(body.data.draftsLimit).toBe(DRAFT_LIMITS.free);
    expect(body.data.currentPeriodEnd).toBe(nextPeriodStart.toISOString());
  });
});

describe('Auth', () => {
  it('returns 401 without auth header', async () => {
    setSystemTime('2026-01-15T12:00:00.000Z');
    const store = new Map<string, User>();
    mockUsers.mockImplementation(() => createUsersCollection(store));

    const app = createApp();
    const response = await app.request('/user/profile');

    expect(response.status).toBe(HTTP_UNAUTHORIZED);

    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});
