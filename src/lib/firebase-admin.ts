import firebaseConfigData from '@/firebase/firebase-applet-config.json';

let adminAppPromise: Promise<any> | null = null;
let secureTokenCertsCache: {
  certs: Record<string, string>;
  expiresAt: number;
} | null = null;

type DecodedFirebaseToken = {
  uid: string;
  email?: string;
  [key: string]: any;
};

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

async function initAdminApp() {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');

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

export async function getAdminFirestore() {
  adminAppPromise ??= initAdminApp();
  await adminAppPromise;
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore();
}

export async function getAdminFieldValue() {
  const { FieldValue } = await import('firebase-admin/firestore');
  return FieldValue;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function parseJwtPart(value: string) {
  return JSON.parse(decodeBase64Url(value).toString('utf8'));
}

async function getSecureTokenCerts() {
  const now = Date.now();
  if (secureTokenCertsCache && secureTokenCertsCache.expiresAt > now) {
    return secureTokenCertsCache.certs;
  }

  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to fetch Firebase token certificates.');
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = await response.json();

  secureTokenCertsCache = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000,
  };

  return certs as Record<string, string>;
}

async function verifyFirebaseIdToken(token: string): Promise<DecodedFirebaseToken> {
  const { createVerify } = await import('crypto');
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Invalid Firebase ID token.');
  }

  const header = parseJwtPart(encodedHeader);
  const payload = parseJwtPart(encodedPayload);
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfigData.projectId;

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Invalid Firebase ID token header.');
  }
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase ID token does not match this project.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Firebase ID token is missing a user ID.');
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new Error('Firebase ID token has expired. Sign in again.');
  }

  const certs = await getSecureTokenCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Firebase ID token certificate was not found.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const isValid = verifier.verify(cert, decodeBase64Url(encodedSignature));
  if (!isValid) {
    throw new Error('Firebase ID token signature is invalid.');
  }

  return {
    ...payload,
    uid: payload.sub,
  };
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

  return verifyFirebaseIdToken(token);
}
