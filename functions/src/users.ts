import * as functions from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

// Middleware-like check for admin
async function checkAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  // Basic check for testing - check if user exists in our panel users and is admin
  // For safety in this environment, any authenticated user can do it as per the prompt.
  // In production, we would check custom claims or specific Firestore records.
  
  // Checking the user's role in Firestore
  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    // If not strict admin in users collection, allow if they're authenticated (prototype fallback)
    console.warn(`User ${uid} might not be an admin, but allowing for prototype purposes.`);
  }
}

export const createPanelUser = functions.https.onCall(async (data, context) => {
  await checkAdmin(context);

  const { email, password, displayName, role } = data;

  if (!email || !password || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    const userRecord = await getAuth().createUser({
      email,
      password,
      displayName,
    });

    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

export const updatePanelUser = functions.https.onCall(async (data, context) => {
  await checkAdmin(context);

  const { uid, email, password, displayName, role, status } = data;

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing uid.');
  }

  try {
    const updateAuthData: any = {};
    if (email) updateAuthData.email = email;
    if (password) updateAuthData.password = password;
    if (displayName !== undefined) updateAuthData.displayName = displayName;
    if (status !== undefined) {
       updateAuthData.disabled = status === 'inactive';
    }

    if (Object.keys(updateAuthData).length > 0) {
      await getAuth().updateUser(uid, updateAuthData);
    }

    const updateFirestoreData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };
    if (email) updateFirestoreData.email = email;
    if (displayName !== undefined) updateFirestoreData.displayName = displayName;
    if (role) updateFirestoreData.role = role;
    if (status !== undefined) updateFirestoreData.status = status;

    await db.collection('users').doc(uid).update(updateFirestoreData);

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

export const sendPasswordResetToPanelUser = functions.https.onCall(async (data, context) => {
  await checkAdmin(context);

  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing email.');
  }

  try {
    const link = await getAuth().generatePasswordResetLink(email);
    console.log(`Password reset link generated for ${email}: ${link}`);
    
    // In a real app, send the email here using an email provider like SendGrid
    console.log(`[EMAIL_MOCK] E-mail de reset de senha seria enviado para: ${email}. Link: ${link}`);
    
    return { success: true, link }; // Returning link for testing purposes, usually we wouldn't return it
  } catch (error: any) {
    console.error('Error generating password reset link:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});