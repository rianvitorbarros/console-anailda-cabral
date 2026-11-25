"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetToPanelUser = exports.updatePanelUser = exports.createPanelUser = void 0;
const functions = require("firebase-functions");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
// Middleware-like check for admin
async function checkAdmin(context) {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // Basic check for testing - check if user exists in our panel users and is admin
    // For safety in this environment, any authenticated user can do it as per the prompt.
    // In production, we would check custom claims or specific Firestore records.
    // Checking the user's role in Firestore
    const uid = context.auth.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        // If not strict admin in users collection, allow if they're authenticated (prototype fallback)
        console.warn(`User ${uid} might not be an admin, but allowing for prototype purposes.`);
    }
}
exports.createPanelUser = functions.https.onCall(async (data, context) => {
    await checkAdmin(context);
    const { email, password, displayName, role } = data;
    if (!email || !password || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }
    try {
        const userRecord = await (0, auth_1.getAuth)().createUser({
            email,
            password,
            displayName,
        });
        await db.collection('users').doc(userRecord.uid).set({
            email,
            displayName,
            role,
            status: 'active',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp()
        });
        return { success: true, uid: userRecord.uid };
    }
    catch (error) {
        console.error('Error creating user:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.updatePanelUser = functions.https.onCall(async (data, context) => {
    await checkAdmin(context);
    const { uid, email, password, displayName, role, status } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing uid.');
    }
    try {
        const updateAuthData = {};
        if (email)
            updateAuthData.email = email;
        if (password)
            updateAuthData.password = password;
        if (displayName !== undefined)
            updateAuthData.displayName = displayName;
        if (status !== undefined) {
            updateAuthData.disabled = status === 'inactive';
        }
        if (Object.keys(updateAuthData).length > 0) {
            await (0, auth_1.getAuth)().updateUser(uid, updateAuthData);
        }
        const updateFirestoreData = {
            updatedAt: firestore_1.FieldValue.serverTimestamp()
        };
        if (email)
            updateFirestoreData.email = email;
        if (displayName !== undefined)
            updateFirestoreData.displayName = displayName;
        if (role)
            updateFirestoreData.role = role;
        if (status !== undefined)
            updateFirestoreData.status = status;
        await db.collection('users').doc(uid).update(updateFirestoreData);
        return { success: true };
    }
    catch (error) {
        console.error('Error updating user:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.sendPasswordResetToPanelUser = functions.https.onCall(async (data, context) => {
    await checkAdmin(context);
    const { email } = data;
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing email.');
    }
    try {
        const link = await (0, auth_1.getAuth)().generatePasswordResetLink(email);
        console.log(`Password reset link generated for ${email}: ${link}`);
        // In a real app, send the email here using an email provider like SendGrid
        console.log(`[EMAIL_MOCK] E-mail de reset de senha seria enviado para: ${email}. Link: ${link}`);
        return { success: true, link }; // Returning link for testing purposes, usually we wouldn't return it
    }
    catch (error) {
        console.error('Error generating password reset link:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=users.js.map