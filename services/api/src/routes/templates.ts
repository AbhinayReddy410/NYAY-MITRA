import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import type { PaginatedResponse, Template } from '@nyayamitra/shared';

import { notFound } from '../lib/errors';
import { templates } from '../lib/firebase';
import { searchTemplates } from '../lib/typesense';

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

async function listTemplates(c: Context): Promise<Response> {
  const { categoryId, search, page, limit } = c.req.valid('query');

  if (search) {
    const filterBy = buildFilterBy(categoryId);
    const result = await searchTemplates<TemplateSummary>(search, filterBy, page, limit);
    const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / limit);
    const response: TemplateListResponse = {
      data: result.hits,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages
      }
    };
    return c.json(response);
  }

  let query = templates().where('isActive', '==', true);
  if (categoryId) {
    query = query.where('categoryId', '==', categoryId);
  }

  const countSnapshot = await query.count().get();
  const total = countSnapshot.data().count;
  const offset = (page - 1) * limit;
  const snapshot = await query.offset(offset).limit(limit).get();
  const data = snapshot.docs.map((doc) => toSummary(doc.data() as Template, doc.id));
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const response: TemplateListResponse = {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };

  return c.json(response);
}

async function getTemplate(c: Context): Promise<Response> {
  const { id } = c.req.valid('param');
  const doc = await templates().doc(id).get();

  if (!doc.exists) {
    throw notFound('Template not found');
  }

  const template = doc.data() as Template | undefined;
  if (!template || !template.isActive) {
    throw notFound('Template not found');
  }

  return c.json({ data: { ...template, id: doc.id } });
}

templatesRouter.get('/', zValidator('query', listQuerySchema), listTemplates);
templatesRouter.get('/:id', zValidator('param', paramsSchema), getTemplate);
