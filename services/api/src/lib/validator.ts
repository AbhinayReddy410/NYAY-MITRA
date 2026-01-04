import type { Env, MiddlewareHandler } from 'hono';
import { zValidator as baseValidator } from '@hono/zod-validator';
import type { ZodTypeAny, input as ZodInput, output as ZodOutput } from 'zod/v3';

export type ValidationTarget = 'json' | 'form' | 'query' | 'param' | 'header' | 'cookie';

export type ValidatedInput<Target extends ValidationTarget, Schema extends ZodTypeAny> = {
  in: { [K in Target]: ZodInput<Schema> };
  out: { [K in Target]: ZodOutput<Schema> };
};

type Validator = <T extends ZodTypeAny, Target extends ValidationTarget, E extends Env = Env, P extends string = string>(
  target: Target,
  schema: T
) => MiddlewareHandler<E, P, ValidatedInput<Target, T>>;

export const zValidator = baseValidator as unknown as Validator;
