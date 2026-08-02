import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfigData from '@/firebase/firebase-applet-config.json';

function getPrivateKey() {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!rawKey) return undefined;

  const trimmedKey = rawKey.trim();
  const unquotedKey =
    (trimmedKey.startsWith('"') && trimmedKey.endsWith('"')) ||
    (trimmedKey.startsWith("'") && trimmedKey.endsWith("'"))
      ? trimmedKey.slice(1, -1)
      : trimmedKey;

  return unquotedKey.replace(/\\n/g, '\n');
}

function initAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const normalizedServiceAccount = serviceAccountJson.trim();
    return initializeApp({
      credential: cert(JSON.parse(normalizedServiceAccount)),
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfigData.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Vercel.');
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminAuth() {
  initAdminApp();
  return getAuth();
}

export function getAdminFirestore() {
  initAdminApp();
  return getFirestore();
}

export async function requireUserIdFromRequest(request: Request) {
  const decoded = await requireDecodedTokenFromRequest(request);
  return decoded.uid;
}

export async function requireDecodedTokenFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  if (!token) {
    throw new Error('Sign in is required.');
  }

  return getAdminAuth().verifyIdToken(token);
}
