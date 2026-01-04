import { vi } from 'vitest';
import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  QuerySnapshot,
  Transaction
} from 'firebase-admin/firestore';

type DocInput<T> = {
  id: string;
  data: T;
};

function getRecordField(data: unknown, field: string): unknown {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  return (data as Record<string, unknown>)[field];
}

export function createMockDocumentSnapshot<T>(
  exists: boolean,
  data?: T,
  id: string = 'doc-id'
): DocumentSnapshot<T> {
  const ref = createMockDocumentReference<T>(id);
  return {
    exists,
    id,
    ref,
    data: () => data,
    get: (field: string) => getRecordField(data, field)
  } as unknown as DocumentSnapshot<T>;
}

export function createMockQuerySnapshot<T>(docs: DocInput<T>[]): QuerySnapshot<T> {
  const snapshots = docs.map(({ id, data }) => createMockDocumentSnapshot(true, data, id));
  return {
    empty: snapshots.length === 0,
    size: snapshots.length,
    docs: snapshots,
    forEach: (callback: (doc: DocumentSnapshot<T>) => void) => {
      snapshots.forEach(callback);
    }
  } as unknown as QuerySnapshot<T>;
}

export function createMockDocumentReference<T>(id: string = 'doc-id'): DocumentReference<T> {
  return {
    id,
    path: `collection/${id}`,
    parent: null as unknown as CollectionReference<DocumentData>,
    firestore: {} as Firestore,
    collection: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isEqual: vi.fn()
  } as unknown as DocumentReference<T>;
}

export function createMockCollectionReference<T>(overrides?: Record<string, unknown>): CollectionReference<T> {
  const base: Record<string, unknown> = {
    id: 'collection',
    path: 'collection',
    parent: null as unknown as DocumentReference<DocumentData>,
    firestore: {} as Firestore,
    doc: vi.fn((id?: string) => createMockDocumentReference<T>(id ?? 'doc-id')),
    add: vi.fn(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    count: vi.fn(),
    get: vi.fn(),
    listDocuments: vi.fn(),
    withConverter: vi.fn().mockReturnThis(),
    isEqual: vi.fn()
  };

  return { ...base, ...overrides } as unknown as CollectionReference<T>;
}

export function createMockFirestore(): Firestore {
  return {
    collection: vi.fn((path: string) => createMockCollectionReference({ path })),
    doc: vi.fn((path: string) => createMockDocumentReference(path)),
    batch: vi.fn(),
    runTransaction: vi.fn()
  } as unknown as Firestore;
}

export function createMockTransaction(overrides?: Record<string, unknown>): Transaction {
  const base: Record<string, unknown> = {
    get: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  };

  return { ...base, ...overrides } as unknown as Transaction;
}
