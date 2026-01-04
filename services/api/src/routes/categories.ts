import { Hono } from 'hono';
import type { Context } from 'hono';

import type { Category } from '@nyayamitra/shared';

import { categories } from '../lib/firebase';
import { authMiddleware } from '../middleware/auth';

export const categoriesRouter = new Hono();

categoriesRouter.use('*', authMiddleware());

async function listCategories(c: Context): Promise<Response> {
  const snapshot = await categories().where('isActive', '==', true).orderBy('order', 'asc').get();
  const data = snapshot.docs.map((doc) => {
    const category = doc.data() as Category;
    return { ...category, id: doc.id };
  });
  return c.json({ data });
}

categoriesRouter.get('/', listCategories);
