import { createHmac } from 'crypto';
import type { DocumentReference } from 'firebase-admin/firestore';

import type { User, UserPlan } from '@nyayamitra/shared';

import { env } from '../lib/env';
import { users } from '../lib/firebase';
import { razorpay } from '../lib/razorpay';

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

type SubscriptionEntity = NonNullable<WebhookEvent['payload']['subscription']>['entity'];
type PaymentEntity = NonNullable<WebhookEvent['payload']['payment']>['entity'];

const RAZORPAY_PRO_PLAN_ID = 'plan_pro_monthly';
const RAZORPAY_UNLIMITED_PLAN_ID = 'plan_unlimited_monthly';
const RAZORPAY_WEBHOOK_SECRET = env.RAZORPAY_KEY_SECRET;
const HMAC_ALGORITHM = 'sha256';
const HMAC_DIGEST = 'hex';
const WEBHOOK_SIGNATURE_HEADER = 'x-razorpay-signature';

const SUBSCRIPTION_ACTIVATED = 'subscription.activated';
const SUBSCRIPTION_CHARGED = 'subscription.charged';
const SUBSCRIPTION_CANCELLED = 'subscription.cancelled';
const SUBSCRIPTION_HALTED = 'subscription.halted';

const STATUS_ACTIVE = 'active';
const STATUS_CANCELLED = 'cancelled';
const STATUS_PAST_DUE = 'past_due';
const STATUS_NONE = 'none';

const PLAN_FREE: UserPlan = 'free';
const PLAN_PRO: UserPlan = 'pro';
const PLAN_UNLIMITED: UserPlan = 'unlimited';

const EMPTY_STRING = '';
const MILLISECONDS_PER_SECOND = 1000;

function getPlanFromRazorpayPlanId(planId: string): UserPlan {
  if (planId === RAZORPAY_UNLIMITED_PLAN_ID) {
    return PLAN_UNLIMITED;
  }
  if (planId === RAZORPAY_PRO_PLAN_ID) {
    return PLAN_PRO;
  }
  return PLAN_FREE;
}

function toIso(timestamp: number): string {
  return new Date(timestamp * MILLISECONDS_PER_SECOND).toISOString();
}

export async function createSubscription(userId: string, planId: UserPlan): Promise<SubscriptionResponse> {
  const razorpayPlanId = planId === PLAN_UNLIMITED ? RAZORPAY_UNLIMITED_PLAN_ID : RAZORPAY_PRO_PLAN_ID;

  const subscription = await razorpay.subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: 12,
    customer_notify: 1
  });

  const userRef = users().doc(userId) as DocumentReference<User>;
  await userRef.update({
    subscriptionId: subscription.id,
    plan: planId,
    subscriptionStatus: STATUS_NONE
  });

  return {
    subscriptionId: subscription.id,
    razorpayKeyId: env.RAZORPAY_KEY_ID
  };
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = createHmac(HMAC_ALGORITHM, RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest(HMAC_DIGEST);

  return signature === expectedSignature;
}

export async function cancelSubscription(subscriptionId: string, userId: string): Promise<void> {
  await razorpay.subscriptions.cancel(subscriptionId);

  const userRef = users().doc(userId) as DocumentReference<User>;
  await userRef.update({
    subscriptionStatus: STATUS_CANCELLED,
    plan: PLAN_FREE,
    subscriptionId: EMPTY_STRING
  });
}

async function handleSubscriptionActivated(subscriptionEntity: SubscriptionEntity): Promise<void> {
  if (!subscriptionEntity?.id || !subscriptionEntity?.plan_id) {
    return;
  }

  const subscriptionId = subscriptionEntity.id;
  const planId = subscriptionEntity.plan_id;
  const plan = getPlanFromRazorpayPlanId(planId);

  const usersSnapshot = await users().where('subscriptionId', '==', subscriptionId).limit(1).get();

  if (usersSnapshot.empty) {
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userRef = userDoc.ref as DocumentReference<User>;

  await userRef.update({
    plan,
    subscriptionStatus: STATUS_ACTIVE
  });
}

async function handleSubscriptionCharged(paymentEntity: PaymentEntity): Promise<void> {
  if (!paymentEntity?.subscription_id || paymentEntity?.status !== 'captured') {
    return;
  }

  const subscriptionId = paymentEntity.subscription_id;
  const usersSnapshot = await users().where('subscriptionId', '==', subscriptionId).limit(1).get();

  if (usersSnapshot.empty) {
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userRef = userDoc.ref as DocumentReference<User>;

  await userRef.update({
    subscriptionStatus: STATUS_ACTIVE
  });
}

async function handleSubscriptionCancelled(subscriptionEntity: SubscriptionEntity): Promise<void> {
  if (!subscriptionEntity?.id) {
    return;
  }

  const subscriptionId = subscriptionEntity.id;
  const usersSnapshot = await users().where('subscriptionId', '==', subscriptionId).limit(1).get();

  if (usersSnapshot.empty) {
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userRef = userDoc.ref as DocumentReference<User>;

  await userRef.update({
    plan: PLAN_FREE,
    subscriptionStatus: STATUS_CANCELLED,
    subscriptionId: EMPTY_STRING
  });
}

async function handleSubscriptionHalted(subscriptionEntity: SubscriptionEntity): Promise<void> {
  if (!subscriptionEntity?.id) {
    return;
  }

  const subscriptionId = subscriptionEntity.id;
  const usersSnapshot = await users().where('subscriptionId', '==', subscriptionId).limit(1).get();

  if (usersSnapshot.empty) {
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userRef = userDoc.ref as DocumentReference<User>;

  await userRef.update({
    subscriptionStatus: STATUS_PAST_DUE
  });
}

export async function processWebhookEvent(event: WebhookEvent, webhookId: string): Promise<void> {
  const db = users().firestore;
  const webhookRef = db.collection('webhooks').doc(webhookId);

  const webhookDoc = await webhookRef.get();
  if (webhookDoc.exists) {
    return;
  }

  await webhookRef.set({
    eventType: event.event,
    processedAt: new Date().toISOString(),
    payload: event.payload
  });

  const eventType = event.event;

  switch (eventType) {
    case SUBSCRIPTION_ACTIVATED:
      await handleSubscriptionActivated(event.payload.subscription?.entity);
      break;
    case SUBSCRIPTION_CHARGED:
      await handleSubscriptionCharged(event.payload.payment?.entity);
      break;
    case SUBSCRIPTION_CANCELLED:
      await handleSubscriptionCancelled(event.payload.subscription?.entity);
      break;
    case SUBSCRIPTION_HALTED:
      await handleSubscriptionHalted(event.payload.subscription?.entity);
      break;
    default:
      break;
  }
}
