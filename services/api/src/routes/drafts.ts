import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context, Input } from 'hono';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { z } from 'zod/v3';

import { CreateDraftRequestSchema, DRAFT_LIMITS, ERROR_CODES } from '@nyayamitra/shared';
import type { Draft, PaginatedResponse, Template, TemplateVariable, User, UserPlan } from '@nyayamitra/shared';

import { ApiError, notFound, validationError } from '../lib/errors';
import { db, getSignedUrl, getTemplateFile, templates, uploadDraft, userDrafts, users } from '../lib/firebase';
import type { ValidatedInput } from '../lib/validator';
import { zValidator } from '../lib/validator';
import { authMiddleware } from '../middleware/auth';
import { generateDocument } from '../services/documentGenerator';
import { validateVariables } from '../services/variableValidator';

type DraftSummary = Omit<Draft, 'variables'>;

type DraftListResponse = PaginatedResponse<DraftSummary>;

type DraftVariables = { user: DecodedIdToken };

type DraftEnv = { Variables: DraftVariables };

type UserRecord = {
  ref: DocumentReference<User>;
  data: User;
};

const DEFAULT_PLAN: UserPlan = 'free';
const DEFAULT_DRAFTS_USED = 0;
const EMPTY_STRING = '';
const FIRST_DAY_OF_MONTH = 1;
const PAGE_OFFSET = 1;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const EMPTY_TOTAL = 0;
const INCREMENT_STEP = 1;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_MINUTE = 60 * 1000;
const DRAFT_EXPIRY_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;
const DRAFT_ID_RANDOM_LENGTH = 8;
const DRAFTS_PATH_PREFIX = 'drafts';
const DOCX_EXTENSION = '.docx';
const HTTP_PAYMENT_REQUIRED = 402;

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
});

export const draftsRouter = new Hono<DraftEnv>();

type DraftCreateInput = ValidatedInput<'json', typeof CreateDraftRequestSchema>;

type DraftHistoryInput = ValidatedInput<'query', typeof historyQuerySchema>;

draftsRouter.use('*', authMiddleware());

function getAuthUser<I extends Input>(c: Context<DraftEnv, string, I>): DecodedIdToken {
  return c.get('user');
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), FIRST_DAY_OF_MONTH));
}

function toIso(date: Date): string {
  return date.toISOString();
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
    return { ref, data: created };
  }

  return { ref, data: { ...existing, uid: snapshot.id } };
}

function buildDraftId(timestamp: number, uuid: string): string {
  return `${timestamp}-${uuid.slice(0, DRAFT_ID_RANDOM_LENGTH)}`;
}

function buildDraftPath(userId: string, draftId: string): string {
  return `${DRAFTS_PATH_PREFIX}/${userId}/${draftId}${DOCX_EXTENSION}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

function parseDate(value: string): Date | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed);
}

function toSummary(draft: Draft, id: string): DraftSummary {
  const { variables: _variables, ...rest } = draft;
  return { ...rest, id };
}

async function incrementDraftUsage(userRef: DocumentReference<User>): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const current = snapshot.data() as User | undefined;

    if (!snapshot.exists || !current) {
      return;
    }

    transaction.update(userRef, {
      draftsUsedThisMonth: current.draftsUsedThisMonth + INCREMENT_STEP
    });
  });
}

async function createDraft(c: Context<DraftEnv, string, DraftCreateInput>): Promise<Response> {
  const authUser = getAuthUser(c);
  const now = new Date();
  const timestamp = now.getTime();
  const { templateId, variables } = c.req.valid('json');

  const userRecord = await getOrCreateUser(authUser, now);
  const draftsLimit = getDraftsLimit(userRecord.data.plan);

  if (userRecord.data.draftsUsedThisMonth >= draftsLimit) {
    throw new ApiError(ERROR_CODES.DRAFT_LIMIT_EXCEEDED, 'Draft limit exceeded', HTTP_PAYMENT_REQUIRED, {
      used: userRecord.data.draftsUsedThisMonth,
      limit: draftsLimit
    });
  }

  const templateDoc = await templates().doc(templateId).get();
  if (!templateDoc.exists) {
    throw notFound('Template not found');
  }

  const template = templateDoc.data() as Template | undefined;
  if (!template || !template.isActive) {
    throw notFound('Template not found');
  }

  const schema = (template.variables ?? []) as TemplateVariable[];
  const validationResult = validateVariables(schema, variables);

  if (!validationResult.valid) {
    throw validationError('Invalid variables', validationResult.errors);
  }

  const templateBuffer = await getTemplateFile(templateDoc.id);
  const documentResult = generateDocument({
    templateBuffer,
    variables: validationResult.sanitized,
    schema
  });

  const draftId = buildDraftId(timestamp, randomUUID());
  const downloadUrl = await uploadDraft(authUser.uid, draftId, documentResult.buffer);
  const expiresAt = toIso(addMinutes(now, DRAFT_EXPIRY_MINUTES));

  const draft: Draft = {
    id: draftId,
    userId: authUser.uid,
    templateId: templateDoc.id,
    templateName: template.name,
    categoryName: template.categoryName,
    generatedFileURL: downloadUrl,
    variables: validationResult.sanitized,
    createdAt: toIso(now),
    expiresAt
  };

  await userDrafts(authUser.uid).doc(draftId).set(draft);
  await incrementDraftUsage(userRecord.ref);

  return c.json({
    data: {
      draftId,
      downloadUrl,
      expiresAt
    }
  });
}

async function listHistory(c: Context<DraftEnv, string, DraftHistoryInput>): Promise<Response> {
  const authUser = getAuthUser(c);
  const { page, limit } = c.req.valid('query');
  const now = new Date();

  const query = userDrafts(authUser.uid).orderBy('createdAt', 'desc');
  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;
  const offset = (page - PAGE_OFFSET) * limit;
  const snapshot = await query.offset(offset).limit(limit).get();

  const refreshedDrafts = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() as Draft;
      const expiresAt = data.expiresAt;
      const parsedExpiry = parseDate(expiresAt);
      const isExpired = !parsedExpiry || parsedExpiry.getTime() < now.getTime();

      if (isExpired) {
        const newExpiresAt = toIso(addMinutes(now, DRAFT_EXPIRY_MINUTES));
        const path = buildDraftPath(authUser.uid, doc.id);
        const newUrl = await getSignedUrl(path, DRAFT_EXPIRY_MINUTES);
        await userDrafts(authUser.uid).doc(doc.id).update({
          generatedFileURL: newUrl,
          expiresAt: newExpiresAt
        });

        const updatedDraft: Draft = {
          ...data,
          generatedFileURL: newUrl,
          expiresAt: newExpiresAt
        };

        return toSummary(updatedDraft, doc.id);
      }

      return toSummary(data, doc.id);
    })
  );

  const totalPages = total === EMPTY_TOTAL ? EMPTY_TOTAL : Math.ceil(total / limit);
  const response: DraftListResponse = {
    data: refreshedDrafts,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };

  return c.json(response);
}

draftsRouter.post('/', zValidator('json', CreateDraftRequestSchema), createDraft);
draftsRouter.get('/history', zValidator('query', historyQuerySchema), listHistory);
