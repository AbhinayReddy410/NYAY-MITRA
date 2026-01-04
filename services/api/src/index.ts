import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';

import { env } from './lib/env';
import { handleError } from './middleware/errorHandler';
import { categoriesRouter } from './routes/categories';
import { draftsRouter } from './routes/drafts';
import { paymentsRouter } from './routes/payments';
import { templatesRouter } from './routes/templates';
import { userRouter } from './routes/user';

export const app = new Hono();
app.onError(handleError);

function healthHandler(c: Context): Response {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
}

app.get('/health', healthHandler);
app.route('/categories', categoriesRouter);
app.route('/drafts', draftsRouter);
app.route('/payments', paymentsRouter);
app.route('/templates', templatesRouter);
app.route('/user', userRouter);

export function startServer(): void {
  serve({ fetch: app.fetch, port: env.PORT });
}

startServer();
