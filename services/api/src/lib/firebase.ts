import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { CollectionReference, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Storage } from 'firebase-admin/storage';

import type { Category, Draft, Template, User } from '@nyayamitra/shared';

import { env } from './env';

const TEMPLATE_FILE_PREFIX = 'templates';
const DRAFT_FILE_PREFIX = 'drafts';
const DOCX_EXTENSION = '.docx';
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60 * 1000;
const DRAFT_URL_EXPIRY_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;

interface ParsedServiceAccount extends ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

function parseServiceAccount(raw: string | undefined): ParsedServiceAccount {
  if (!raw) {
    throw new Error('Missing env var: FIREBASE_SERVICE_ACCOUNT');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
  }

  const projectId = getStringField(parsed, 'project_id') || env.FIREBASE_PROJECT_ID;
  const clientEmail = getStringField(parsed, 'client_email');
  const privateKey = getStringField(parsed, 'private_key');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n')
  };
}

function getStorageBucket(projectId: string): string {
  return `${projectId}.appspot.com`;
}

function getFirebaseApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
    storageBucket: getStorageBucket(serviceAccount.projectId)
  });
}

const firebaseApp = getFirebaseApp();

export const db: Firestore = getFirestore(firebaseApp);
export const storage: Storage = getStorage(firebaseApp);
export const auth: Auth = getAuth(firebaseApp);

export function users(): CollectionReference<User> {
  return db.collection('users') as CollectionReference<User>;
}

export function categories(): CollectionReference<Category> {
  return db.collection('categories') as CollectionReference<Category>;
}

export function templates(): CollectionReference<Template> {
  return db.collection('templates') as CollectionReference<Template>;
}

export function userDrafts(userId: string): CollectionReference<Draft> {
  return users().doc(userId).collection('drafts') as CollectionReference<Draft>;
}

function buildTemplatePath(templateId: string): string {
  return `${TEMPLATE_FILE_PREFIX}/${templateId}${DOCX_EXTENSION}`;
}

function buildDraftPath(userId: string, draftId: string): string {
  return `${DRAFT_FILE_PREFIX}/${userId}/${draftId}${DOCX_EXTENSION}`;
}

export async function getTemplateFile(templateId: string): Promise<Buffer> {
  const path = buildTemplatePath(templateId);
  const [buffer] = await storage.bucket().file(path).download();
  return buffer;
}

export async function uploadDraft(userId: string, draftId: string, buffer: Buffer): Promise<string> {
  const path = buildDraftPath(userId, draftId);
  await storage.bucket().file(path).save(buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  return getSignedUrl(path, DRAFT_URL_EXPIRY_MINUTES);
}

export async function getSignedUrl(path: string, expiryMinutes: number): Promise<string> {
  const expiresAt = Date.now() + expiryMinutes * MS_PER_MINUTE;
  const [url] = await storage.bucket().file(path).getSignedUrl({
    action: 'read',
    expires: expiresAt
  });
  return url;
}
