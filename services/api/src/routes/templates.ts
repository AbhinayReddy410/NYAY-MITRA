import { Hono } from 'hono';
import type { Context, Env } from 'hono';
import { z } from 'zod/v3';

import type { PaginatedResponse, Template } from '@nyayamitra/shared';

import { notFound } from '../lib/errors';
import { getSupabase } from '../lib/supabase';
import type { ValidatedInput } from '../lib/validator';
import { zValidator } from '../lib/validator';

type TemplateSummary = Omit<Template, 'variables' | 'templateFileURL'>;

type TemplateListResponse = PaginatedResponse<TemplateSummary>;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const listQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
});

const paramsSchema = z.object({
  id: z.string().min(1)
});

export const templatesRouter = new Hono();

type TemplateListInput = ValidatedInput<'query', typeof listQuerySchema>;

type TemplateParamInput = ValidatedInput<'param', typeof paramsSchema>;

function toSummary(template: Template, id: string): TemplateSummary {
  const { variables: _variables, templateFileURL: _file, id: _id, ...rest } = template;
  return { ...rest, id };
}

function buildFilterBy(categoryId: string | undefined): string {
  const filters = ['isActive:=true'];
  if (categoryId) {
    filters.push(`categoryId:=${categoryId}`);
  }
  return filters.join(' && ');
}

async function listTemplates(c: Context<Env, string, TemplateListInput>): Promise<Response> {
  const { categoryId, search, page, limit } = c.req.valid('query');
  const supabase = getSupabase();

  const offset = (page - 1) * limit;
  let query = supabase
    .from('templates')
    .select('id, name, slug, description, keywords, category_id, estimated_minutes, usage_count, created_at, is_active', { count: 'exact' })
    .eq('is_active', true)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  if (search) {
    query = query.textSearch('name', search, { type: 'websearch', config: 'english' });
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const total = count || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const response: TemplateListResponse = {
    data: data || [],
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };

  return c.json(response);
}

async function getTemplate(c: Context<Env, string, TemplateParamInput>): Promise<Response> {
  const { id } = c.req.valid('param');

  const { data, error } = await getSupabase()
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw notFound('Template not found');
  }

  return c.json({ data });
}

templatesRouter.get('/', zValidator('query', listQuerySchema), listTemplates);
templatesRouter.get('/:id', zValidator('param', paramsSchema), getTemplate);
