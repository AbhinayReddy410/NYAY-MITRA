import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

import type { Category, Template, User, TemplateVariable } from '@nyayamitra/shared';

export function createTestUser(overrides?: Partial<User>): User {
  const now = new Date();
  const nowIso = now.toISOString();
  const resetDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return {
    uid: 'test-user-123',
    email: 'test@example.com',
    phone: '',
    displayName: 'Test User',
    plan: 'free',
    draftsUsedThisMonth: 0,
    draftsResetDate: resetDate,
    subscriptionId: '',
    subscriptionStatus: 'none',
    createdAt: nowIso,
    lastLoginAt: nowIso,
    ...overrides,
  };
}

export function createTestCategory(overrides?: Partial<Category>): Category {
  return {
    id: 'cat-civil',
    name: 'Civil',
    slug: 'civil',
    icon: 'briefcase',
    description: 'Civil law documents',
    order: 1,
    templateCount: 5,
    isActive: true,
    ...overrides,
  };
}

export function createTestTemplate(overrides?: Partial<Template>): Template {
  const nowIso = new Date().toISOString();
  return {
    id: 'template-001',
    categoryId: 'cat-civil',
    categoryName: 'Civil',
    name: 'Rent Agreement',
    slug: 'rent-agreement',
    description: 'Standard rent agreement template',
    keywords: ['rent', 'lease', 'agreement'],
    templateFileURL: 'gs://nyayamitra/templates/rent-agreement.docx',
    variables: [
      createTestVariable({ name: 'landlord_name', label: 'Landlord Name', type: 'STRING', required: true, order: 1 }),
      createTestVariable({ name: 'tenant_name', label: 'Tenant Name', type: 'STRING', required: true, order: 2 }),
      createTestVariable({ name: 'rent_amount', label: 'Monthly Rent', type: 'CURRENCY', required: true, order: 3 }),
      createTestVariable({ name: 'start_date', label: 'Start Date', type: 'DATE', required: true, order: 4 }),
    ],
    estimatedMinutes: 10,
    isActive: true,
    usageCount: 0,
    createdAt: nowIso,
    ...overrides,
  };
}

export function createTestVariable(overrides?: Partial<TemplateVariable>): TemplateVariable {
  return {
    name: 'field_name',
    label: 'Field Label',
    type: 'STRING',
    required: false,
    maxLength: 0,
    minLength: 0,
    pattern: '',
    options: [],
    placeholder: '',
    helpText: '',
    section: 'default',
    order: 1,
    defaultValue: null,
    ...overrides,
  };
}

export async function seedTestData(db: Firestore): Promise<void> {
  const batch = db.batch();

  // Seed categories
  const categories = [
    createTestCategory({ id: 'cat-civil', name: 'Civil', order: 1 }),
    createTestCategory({ id: 'cat-criminal', name: 'Criminal', slug: 'criminal', order: 2 }),
    createTestCategory({ id: 'cat-family', name: 'Family', slug: 'family', order: 3 }),
    createTestCategory({ id: 'cat-inactive', name: 'Inactive', slug: 'inactive', order: 4, isActive: false }),
  ];

  for (const cat of categories) {
    batch.set(db.collection('categories').doc(cat.id), cat);
  }

  // Seed templates
  const templates = [
    createTestTemplate({ id: 'tpl-1', categoryId: 'cat-civil', name: 'Rent Agreement' }),
    createTestTemplate({ id: 'tpl-2', categoryId: 'cat-civil', name: 'Sale Deed', slug: 'sale-deed' }),
    createTestTemplate({ id: 'tpl-3', categoryId: 'cat-criminal', name: 'Bail Application', slug: 'bail-application' }),
  ];

  for (const tpl of templates) {
    batch.set(db.collection('templates').doc(tpl.id), tpl);
  }

  await batch.commit();
}

/**
 * Creates a complete mock DecodedIdToken for testing
 */
export function createMockDecodedToken(overrides?: {
  uid?: string;
  email?: string;
  phone_number?: string;
  name?: string;
}): DecodedIdToken {
  return {
    uid: overrides?.uid ?? 'test-user-123',
    email: overrides?.email ?? 'test@example.com',
    phone_number: overrides?.phone_number,
    name: overrides?.name ?? 'Test User',
    // Required Firebase token properties
    aud: 'nyayamitra-test',
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: {
      identities: {
        email: [overrides?.email ?? 'test@example.com'],
      },
      sign_in_provider: 'google.com',
    },
    iat: Math.floor(Date.now() / 1000),
    iss: `https://securetoken.google.com/nyayamitra-test`,
    sub: overrides?.uid ?? 'test-user-123',
  };
}
