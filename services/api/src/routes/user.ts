import { Hono } from 'hono';
import type { Context, Input } from 'hono';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';

import { DRAFT_LIMITS, UpdateUserRequestSchema } from '@nyayamitra/shared';
import type { User, UserPlan } from '@nyayamitra/shared';

import { users } from '../lib/firebase';
import type { ValidatedInput } from '../lib/validator';
import { zValidator } from '../lib/validator';
import { authMiddleware } from '../middleware/auth';

type UserVariables = { user: DecodedIdToken };

type UserEnv = { Variables: UserVariables };

type UpdateProfileInput = ValidatedInput<'json', typeof UpdateUserRequestSchema>;

type UserRecord = {
  ref: DocumentReference<User>;
  data: User;
  isNew: boolean;
};

type SubscriptionResponse = {
  plan: UserPlan;
  status: User['subscriptionStatus'];
  draftsUsedThisMonth: number;
  draftsLimit: number;
  currentPeriodEnd: string;
};

const DEFAULT_PLAN: UserPlan = 'free';
const DEFAULT_DRAFTS_USED = 0;
const EMPTY_UPDATE_COUNT = 0;
const FIRST_DAY_OF_MONTH = 1;
const NEXT_MONTH_OFFSET = 1;
const EMPTY_STRING = '';

export const userRouter = new Hono<UserEnv>();

userRouter.use('*', authMiddleware());

function getAuthUser<I extends Input>(c: Context<UserEnv, string, I>): DecodedIdToken {
  return c.get('user');
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), FIRST_DAY_OF_MONTH));
}

function nextMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + NEXT_MONTH_OFFSET, FIRST_DAY_OF_MONTH));
}

function toIso(date: Date): string {
  return date.toISOString();
}

function parseDate(value: string): Date | null {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}

function getDraftsLimit(plan: UserPlan): number {
  return DRAFT_LIMITS[plan];
}

function getDisplayName(authUser: DecodedIdToken): string {
  return authUser.name ?? authUser.email ?? EMPTY_STRING;
}

function buildUser(authUser: DecodedIdToken, now: Date): User {
  const timestamp = toIso(now);
  const resetDate = toIso(startOfMonthUtc(now));

  return {
    uid: authUser.uid,
    email: authUser.email ?? EMPTY_STRING,
    phone: authUser.phone_number ?? EMPTY_STRING,
    displayName: getDisplayName(authUser),
    plan: DEFAULT_PLAN,
    draftsUsedThisMonth: DEFAULT_DRAFTS_USED,
    draftsResetDate: resetDate,
    subscriptionId: EMPTY_STRING,
    subscriptionStatus: 'none',
    createdAt: timestamp,
    lastLoginAt: timestamp
  };
}

async function getOrCreateUser(authUser: DecodedIdToken, now: Date): Promise<UserRecord> {
  const ref = users().doc(authUser.uid) as DocumentReference<User>;
  const snapshot = await ref.get();
  const existing = snapshot.data();

  if (!snapshot.exists || !existing) {
    const created = buildUser(authUser, now);
    await ref.set(created);
    return { ref, data: created, isNew: true };
  }

  return { ref, data: { ...existing, uid: snapshot.id }, isNew: false };
}

async function getProfile(c: Context<UserEnv>): Promise<Response> {
  const authUser = getAuthUser(c);
  const now = new Date();
  const record = await getOrCreateUser(authUser, now);
  const lastLoginAt = toIso(now);

  if (!record.isNew) {
    await record.ref.update({ lastLoginAt });
    record.data = { ...record.data, lastLoginAt };
  }

  const draftsLimit = getDraftsLimit(record.data.plan);

  return c.json({ data: { ...record.data, draftsLimit } });
}

async function updateProfile(c: Context<UserEnv, string, UpdateProfileInput>): Promise<Response> {
  const authUser = getAuthUser(c);
  const now = new Date();
  const { displayName } = c.req.valid('json');
  const record = await getOrCreateUser(authUser, now);

  const updates: Partial<User> = {};
  if (displayName !== undefined) {
    updates.displayName = displayName;
  }

  if (Object.keys(updates).length > EMPTY_UPDATE_COUNT) {
    await record.ref.update(updates);
  }

  return c.json({ data: { ...record.data, ...updates } });
}

function shouldResetDrafts(draftsResetDate: string, now: Date): boolean {
  const parsed = parseDate(draftsResetDate);
  const periodStart = startOfMonthUtc(now);
  if (!parsed) {
    return true;
  }
  return parsed.getTime() < periodStart.getTime();
}

async function getSubscription(c: Context<UserEnv>): Promise<Response> {
  const authUser = getAuthUser(c);
  const now = new Date();
  const record = await getOrCreateUser(authUser, now);
  const periodStart = startOfMonthUtc(now);

  if (shouldResetDrafts(record.data.draftsResetDate, now)) {
    const resetDate = toIso(periodStart);
    await record.ref.update({
      draftsUsedThisMonth: DEFAULT_DRAFTS_USED,
      draftsResetDate: resetDate
    });
    record.data = {
      ...record.data,
      draftsUsedThisMonth: DEFAULT_DRAFTS_USED,
      draftsResetDate: resetDate
    };
  }

  const draftsLimit = getDraftsLimit(record.data.plan);
  const currentPeriodEnd = toIso(nextMonthStartUtc(periodStart));

  const response: SubscriptionResponse = {
    plan: record.data.plan,
    status: record.data.subscriptionStatus,
    draftsUsedThisMonth: record.data.draftsUsedThisMonth,
    draftsLimit,
    currentPeriodEnd
  };

  return c.json({ data: response });
}

userRouter.get('/profile', getProfile);
userRouter.patch('/profile', zValidator('json', UpdateUserRequestSchema), updateProfile);
userRouter.get('/subscription', getSubscription);
