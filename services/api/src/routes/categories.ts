import { Hono } from 'hono';
import type { Context } from 'hono';

import { getSupabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

export const categoriesRouter = new Hono();

categoriesRouter.use('*', authMiddleware());

async function listCategories(c: Context): Promise<Response> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return c.json({ data });
}

categoriesRouter.get('/', listCategories);
