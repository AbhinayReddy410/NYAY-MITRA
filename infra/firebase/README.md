# Firebase Security Rules

This directory contains Firebase security rules for Firestore and Cloud Storage.

## Files

- **firestore.rules** - Firestore security rules
- **storage.rules** - Cloud Storage security rules
- **firebase.json** - Firebase project configuration
- **firestore.indexes.json** - Firestore composite indexes
- **.firebaserc** - Firebase project aliases

## Security Model

### Firestore Rules

#### Users Collection (`/users/{userId}`)
- **Read**: User can read their own document
- **Create**: User can create their own document
- **Update**: User can update their own document, **except** protected fields:
  - `plan` (admin only)
  - `subscriptionId` (admin only)
  - `subscriptionStatus` (admin only)
  - `draftsUsedThisMonth` (server-side only)

#### Drafts Subcollection (`/users/{userId}/drafts/{draftId}`)
- **Read/Write**: User can access their own drafts only

#### Categories Collection (`/categories/{id}`)
- **Read**: Any authenticated user
- **Write**: Admin only (requires `admin` custom claim)

#### Templates Collection (`/templates/{id}`)
- **Read**: Any authenticated user
- **Write**: Admin only (requires `admin` custom claim)

#### Webhooks Collection (`/webhooks/{id}`)
- **Read/Write**: Blocked (server-side only for idempotency tracking)

#### Subscriptions Collection (`/subscriptions/{id}`)
- **Read**: Admin or subscription owner
- **Write**: Blocked (server-side only)

### Storage Rules

#### Templates (`/templates/**`)
- **Read**: Any authenticated user
- **Write**: Admin only (requires `admin` custom claim)

#### Drafts (`/drafts/{userId}/**`)
- **Read**: User can read their own drafts
- **Write**: Blocked (server-side upload only)

## Helper Functions

- `isAuth()` - Checks if user is authenticated
- `isOwner(uid)` - Checks if authenticated user matches UID
- `isAdmin()` - Checks if user has admin custom claim

## Setting Admin Claims

To grant admin access to a user:

```javascript
const admin = require('firebase-admin');

admin.auth().setCustomUserClaims(uid, { admin: true });
```

## Deployment

Deploy rules to Firebase:

```bash
cd infra/firebase
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

## Local Testing

Run Firebase emulators:

```bash
cd infra/firebase
firebase emulators:start
```

Emulator ports:
- Auth: 9099
- Firestore: 8080
- Storage: 9199
- Emulator UI: http://localhost:4000

## Firestore Indexes

Composite indexes are defined for:
- User drafts ordered by creation date
- Templates filtered by category and active status
- Templates ordered by active status and creation date
- Users searchable by email
- Users searchable by phone
- Users filtered by plan and ordered by creation date

## Security Best Practices

1. **Never expose admin endpoints** to client SDKs
2. **Validate all inputs** on the API server before Firestore writes
3. **Use server-side SDKs** for protected operations (subscriptions, webhooks)
4. **Audit admin claims** regularly
5. **Monitor Firestore security rules** for violations in Firebase Console
6. **Test rules** using Firebase Emulator Suite before deployment

## Protected Fields

These fields can only be modified by the API server (not via client SDK):

- `users.plan`
- `users.subscriptionId`
- `users.subscriptionStatus`
- `users.draftsUsedThisMonth`
- All `/webhooks/*` documents
- All `/subscriptions/*` documents

## Testing Rules

Test rules locally:

```bash
npm install -g @firebase/rules-unit-testing
firebase emulators:exec --only firestore "npm test"
```

Example test:

```javascript
const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

it('allows user to read their own data', async () => {
  const db = getFirestore(authedApp('user123'));
  await assertSucceeds(db.collection('users').doc('user123').get());
});

it('denies user from reading others data', async () => {
  const db = getFirestore(authedApp('user123'));
  await assertFails(db.collection('users').doc('user456').get());
});
```
