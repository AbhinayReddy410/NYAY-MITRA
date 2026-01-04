export type UserPlan = 'free' | 'pro' | 'unlimited';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'none';

export interface User {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
  plan: UserPlan;
  draftsUsedThisMonth: number;
  draftsResetDate: string;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  lastLoginAt: string;
}
