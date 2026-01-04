import { Hono } from 'hono';
import type { Context, Input } from 'hono';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod/v3';

import { ERROR_CODES } from '@nyayamitra/shared';

import { ApiError } from '../lib/errors';
import type { ValidatedInput } from '../lib/validator';
import { zValidator } from '../lib/validator';
import { authMiddleware } from '../middleware/auth';
import { cancelSubscription, createSubscription, processWebhookEvent, verifyWebhookSignature } from '../services/razorpayService';

type PaymentVariables = { user: DecodedIdToken };

type PaymentEnv = { Variables: PaymentVariables };

type SubscriptionResponse = {
  subscriptionId: string;
  razorpayKeyId: string;
};

type WebhookEvent = {
  event: string;
  payload: {
    subscription?: {
      entity?: {
        id?: string;
        status?: string;
        customer_id?: string;
        plan_id?: string;
        current_start?: number;
        current_end?: number;
      };
    };
    payment?: {
      entity?: {
        subscription_id?: string;
        status?: string;
      };
    };
  };
};

const WEBHOOK_SIGNATURE_HEADER = 'x-razorpay-signature';
const HTTP_UNAUTHORIZED = 401;

const createSubscriptionSchema = z.object({
  planId: z.enum(['pro', 'unlimited'])
});

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1)
});

export const paymentsRouter = new Hono<PaymentEnv>();

type CreateSubscriptionInput = ValidatedInput<'json', typeof createSubscriptionSchema>;

type CancelSubscriptionInput = ValidatedInput<'json', typeof cancelSubscriptionSchema>;

function getAuthUser<I extends Input>(c: Context<PaymentEnv, string, I>): DecodedIdToken {
  return c.get('user');
}

async function handleCreateSubscription(c: Context<PaymentEnv, string, CreateSubscriptionInput>): Promise<Response> {
  const authUser = getAuthUser(c);
  const { planId } = c.req.valid('json');
  const userId = authUser.uid;

  const result = await createSubscription(userId, planId);

  const response: SubscriptionResponse = {
    subscriptionId: result.subscriptionId,
    razorpayKeyId: result.razorpayKeyId
  };

  return c.json({ data: response });
}

async function handleCancelSubscription(c: Context<PaymentEnv, string, CancelSubscriptionInput>): Promise<Response> {
  const authUser = getAuthUser(c);
  const { subscriptionId } = c.req.valid('json');
  const userId = authUser.uid;

  await cancelSubscription(subscriptionId, userId);

  return c.json({ data: { success: true } });
}

async function handleWebhook(c: Context): Promise<Response> {
  const signature = c.req.header(WEBHOOK_SIGNATURE_HEADER) ?? '';
  const rawBody = await c.req.text();

  if (!signature) {
    throw new ApiError(ERROR_CODES.AUTH_INVALID, 'Missing webhook signature', HTTP_UNAUTHORIZED);
  }

  const isValid = verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
    throw new ApiError(ERROR_CODES.AUTH_INVALID, 'Invalid webhook signature', HTTP_UNAUTHORIZED);
  }

  const event = JSON.parse(rawBody) as WebhookEvent;
  const webhookId = `${event.event}-${Date.now()}`;

  await processWebhookEvent(event, webhookId);

  return c.json({ status: 'processed' });
}

paymentsRouter.post('/create-subscription', authMiddleware(), zValidator('json', createSubscriptionSchema), handleCreateSubscription);
paymentsRouter.post('/cancel-subscription', authMiddleware(), zValidator('json', cancelSubscriptionSchema), handleCancelSubscription);
paymentsRouter.post('/webhook', handleWebhook);
