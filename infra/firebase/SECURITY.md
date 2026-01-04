# Firebase Security Rules Documentation

## Overview

This document explains the security rules implemented for NyayaMitra's Firebase infrastructure.

## Security Principles

1. **Principle of Least Privilege**: Users can only access their own data
2. **Admin Separation**: Admin operations require custom claims
3. **Server-Side Mutations**: Protected fields can only be modified by the API server
4. **Read/Write Separation**: Different permissions for reading vs writing
5. **Defense in Depth**: Client rules + API validation + admin verification

## Firestore Security Rules

### Users Collection

**Path**: `/users/{userId}`

**Rules**:
```javascript
allow read: if isOwner(userId);
allow create: if isOwner(userId);
allow update: if isOwner(userId) && !affectsProtectedFields();
```

**Protected Fields** (cannot be modified by user):
- `plan` - Only API can change subscription plan
- `subscriptionId` - Only API can set Razorpay subscription ID
- `subscriptionStatus` - Only API can update subscription status
- `draftsUsedThisMonth` - Only API can increment usage counter

**Why?**
- Users can update their `displayName` via the profile page
- API server must be the only entity that can modify billing/subscription data
- Prevents users from giving themselves unlimited drafts or premium plans

**Example Valid Update**:
```javascript
// User can update displayName
db.collection('users').doc(userId).update({
  displayName: 'New Name'
});
```

**Example Invalid Update** (will fail):
```javascript
// User CANNOT update plan
db.collection('users').doc(userId).update({
  plan: 'unlimited'  // ❌ Blocked by security rules
});
```

### Drafts Subcollection

**Path**: `/users/{userId}/drafts/{draftId}`

**Rules**:
```javascript
allow read, write: if isOwner(userId);
```

**Why?**
- Drafts are private to each user
- User can read their draft history
- User can delete their own drafts
- API server writes drafts after generation

### Categories Collection

**Path**: `/categories/{id}`

**Rules**:
```javascript
allow read: if isAuth();
allow write: if isAdmin();
```

**Why?**
- All authenticated users can browse categories
- Only admins can create/edit/delete categories via admin panel
- Prevents regular users from tampering with category data

### Templates Collection

**Path**: `/templates/{id}`

**Rules**:
```javascript
allow read: if isAuth();
allow write: if isAdmin();
```

**Why?**
- All authenticated users can browse templates
- Only admins can upload/edit/delete templates
- Template files are stored in Cloud Storage with similar rules

### Webhooks Collection

**Path**: `/webhooks/{id}`

**Rules**:
```javascript
allow read, write: if false;
```

**Why?**
- Webhooks are for idempotency tracking (Razorpay events)
- Only the API server should access this collection
- No client SDK access whatsoever

### Subscriptions Collection

**Path**: `/subscriptions/{id}`

**Rules**:
```javascript
allow read: if isAdmin() || resource.data.userId == request.auth.uid;
allow write: if false;
```

**Why?**
- Users can view their own subscription history
- Admins can view all subscriptions
- Only API server can write (no client mutations)

## Cloud Storage Security Rules

### Templates Storage

**Path**: `/templates/**`

**Rules**:
```javascript
allow read: if request.auth != null;
allow write: if request.auth.token.admin == true;
```

**Why?**
- Any authenticated user can download template files for generation
- Only admins can upload new templates via admin panel
- Template files are referenced in Firestore `/templates` collection

### Drafts Storage

**Path**: `/drafts/{userId}/**`

**Rules**:
```javascript
allow read: if request.auth.uid == userId;
allow write: if false;
```

**Why?**
- Users can only download their own generated drafts
- API server uploads drafts after generation
- No client-side uploads (prevents abuse)
- Files expire after 24 hours (signed URL expiration)

## Admin Custom Claim

The `admin` custom claim is set on Firebase Auth users to grant admin panel access.

### Setting Admin Claim

```bash
# Using the provided script
export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
node set-admin.js admin@nyayamitra.com
```

### Checking Admin Claim

**Server-side** (Firebase Admin SDK):
```javascript
const user = await admin.auth().getUser(uid);
const isAdmin = user.customClaims?.admin === true;
```

**Client-side** (Firebase Auth):
```javascript
const user = auth.currentUser;
const idTokenResult = await user.getIdTokenResult();
const isAdmin = idTokenResult.claims.admin === true;
```

### Security Rules Usage

```javascript
function isAdmin() {
  return request.auth.token.admin == true;
}
```

## Composite Indexes

Required indexes for efficient queries:

### User Drafts
- Collection: `users/{userId}/drafts`
- Fields: `userId` (ASC), `createdAt` (DESC)
- Use: Paginated draft history

### Templates by Category
- Collection: `templates`
- Fields: `categoryId` (ASC), `isActive` (ASC), `name` (ASC)
- Use: Browse active templates in a category

### Templates by Status
- Collection: `templates`
- Fields: `isActive` (ASC), `createdAt` (DESC)
- Use: Admin panel template filtering

### User Search
- Collection: `users`
- Fields: `email` (ASC) and `phone` (ASC)
- Use: Admin panel user search

## Attack Scenarios & Mitigations

### Scenario 1: User Tries to Give Themselves Unlimited Plan

**Attack**:
```javascript
db.collection('users').doc(myUserId).update({
  plan: 'unlimited'
});
```

**Mitigation**:
- ✅ Blocked by Firestore rules (protected field)
- ✅ API validates plan changes come from Razorpay webhooks
- ✅ Admin claim required for manual plan changes

### Scenario 2: User Tries to Access Another User's Drafts

**Attack**:
```javascript
db.collection('users').doc(otherUserId).collection('drafts').get();
```

**Mitigation**:
- ✅ Blocked by Firestore rules (`isOwner` check)
- ✅ Returns permission denied error

### Scenario 3: User Tries to Download Another User's Draft File

**Attack**:
```javascript
const url = 'gs://bucket/drafts/otherUserId/draft.docx';
const ref = storage.ref(url);
await ref.getDownloadURL();
```

**Mitigation**:
- ✅ Blocked by Storage rules (path must match auth UID)
- ✅ Signed URLs contain specific file path and expire in 24h

### Scenario 4: User Tries to Create Templates

**Attack**:
```javascript
db.collection('templates').add({
  name: 'Malicious Template',
  // ...
});
```

**Mitigation**:
- ✅ Blocked by Firestore rules (admin claim required)
- ✅ Template upload goes through admin panel with admin auth

### Scenario 5: User Tries to Reset Draft Counter

**Attack**:
```javascript
db.collection('users').doc(myUserId).update({
  draftsUsedThisMonth: 0
});
```

**Mitigation**:
- ✅ Blocked by Firestore rules (protected field)
- ✅ Counter only resets server-side on month boundary
- ✅ Increment happens in Firestore transaction

## Deployment Checklist

Before deploying to production:

- [ ] Review all security rules
- [ ] Test rules with Firebase Emulator
- [ ] Deploy indexes first: `firebase deploy --only firestore:indexes`
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Storage rules: `firebase deploy --only storage`
- [ ] Verify rules in Firebase Console
- [ ] Set admin claims for admin users
- [ ] Test admin panel access
- [ ] Test regular user access
- [ ] Monitor Security Rules violations in Console

## Monitoring

Monitor security in Firebase Console:

1. **Firestore → Rules**
   - View denied requests
   - See which rules are triggering

2. **Storage → Rules**
   - View access logs
   - Monitor unauthorized access attempts

3. **Authentication → Users**
   - Audit custom claims
   - Review admin users list

## Testing

Run tests with Firebase Emulator:

```bash
npm install
firebase emulators:start
npm test
```

Example test:
```javascript
it('blocks users from modifying protected fields', async () => {
  const db = getFirestore(authedApp('user123'));
  const userRef = db.collection('users').doc('user123');

  await assertFails(
    userRef.update({ plan: 'unlimited' })
  );
});
```

## Emergency Procedures

### Revoke Admin Access

```bash
firebase auth:export users.json
# Find user UID
node revoke-admin.js <user-email>
```

### Temporarily Disable All Writes

Update Firestore rules:
```javascript
match /{document=**} {
  allow read;
  allow write: if false;
}
```

### Audit Recent Changes

```bash
# View Firestore audit logs in Cloud Console
gcloud logging read "resource.type=firestore_database"
```

## Support

For security concerns, contact: security@nyayamitra.com

## References

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Storage Security Rules](https://firebase.google.com/docs/storage/security/start)
- [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
