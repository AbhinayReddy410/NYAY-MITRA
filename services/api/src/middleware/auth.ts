import type { MiddlewareHandler } from 'hono';

import { verifyToken } from '../lib/supabase';
import { authRequired } from '../lib/errors';

export interface AuthVariables {
  userId: string;
  userEmail?: string;
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
      const user = await verifyToken(token);
      if (!user) {
        throw authRequired('Invalid token');
      }
      c.set('userId', user.id);
      c.set('userEmail', user.email);
      await next();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid token')) {
        throw authRequired('Invalid token');
      }
      throw authRequired();
    }
  };
};
