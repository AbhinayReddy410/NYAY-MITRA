#!/usr/bin/env node

/**
 * NyayaMitra - Set Admin Custom Claim
 *
 * Usage:
 *   node set-admin.js <user-email>
 *
 * Example:
 *   node set-admin.js admin@nyayamitra.com
 */

const admin = require('firebase-admin');
const path = require('path');

const EMAIL_ARG_INDEX = 2;
const SUCCESS_EXIT_CODE = 0;
const ERROR_EXIT_CODE = 1;

async function setAdminClaim(email) {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!serviceAccountPath) {
      console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT_PATH environment variable not set');
      console.error('');
      console.error('Set it to the path of your Firebase service account JSON file:');
      console.error('  export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json');
      process.exit(ERROR_EXIT_CODE);
    }

    const serviceAccount = require(path.resolve(serviceAccountPath));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log(`🔍 Looking up user: ${email}`);
    const user = await admin.auth().getUserByEmail(email);

    console.log(`✅ Found user: ${user.uid}`);
    console.log('');

    console.log('📝 Current custom claims:', user.customClaims || {});
    console.log('');

    console.log('🔧 Setting admin claim...');
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log('✅ Admin claim set successfully!');
    console.log('');

    const updatedUser = await admin.auth().getUser(user.uid);
    console.log('📝 Updated custom claims:', updatedUser.customClaims);
    console.log('');

    console.log('⚠️  Note: User must sign out and sign back in for the claim to take effect.');

    process.exit(SUCCESS_EXIT_CODE);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(ERROR_EXIT_CODE);
  }
}

const args = process.argv;

if (args.length < EMAIL_ARG_INDEX + 1) {
  console.error('Usage: node set-admin.js <user-email>');
  console.error('');
  console.error('Example:');
  console.error('  node set-admin.js admin@nyayamitra.com');
  process.exit(ERROR_EXIT_CODE);
}

const email = args[EMAIL_ARG_INDEX];
setAdminClaim(email);
