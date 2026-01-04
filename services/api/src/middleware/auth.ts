import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { MiddlewareHandler } from 'hono';

import { env } from '../lib/env';
import { authRequired } from '../lib/errors';

export interface AuthVariables {
  user: DecodedIdToken;
}

function getFirebaseApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: env.FIREBASE_PROJECT_ID
  });
}

function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export const authMiddleware = (): MiddlewareHandler => {
  return async (c, next): Promise<Response | void> => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw authRequired();
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw authRequired();
    }

    try {
      const decoded = await getFirebaseAuth().verifyIdToken(token);
      c.set('user', decoded);
      await next();
    } catch {
      throw authRequired('Invalid token');
    }
  };
};
