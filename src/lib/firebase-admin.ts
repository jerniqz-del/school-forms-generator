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

const SUPER_ADMIN_EMAILS = new Set(['jerniqz@gmail.com']);

export function isSuperAdminToken(decoded: DecodedFirebaseToken) {
  const email = typeof decoded.email === 'string' ? decoded.email.toLowerCase() : '';
  return decoded.role === 'super_admin' || SUPER_ADMIN_EMAILS.has(email);
}

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

  const storageBucket = getFirebaseStorageBucket();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const normalizedServiceAccount = serviceAccountJson.trim();
    return initializeApp({
      credential: cert(JSON.parse(normalizedServiceAccount)),
      storageBucket,
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
    storageBucket,
  });
}

let resolvedBucketName: string | null = null;

export function getFirebaseStorageBucket() {
  if (resolvedBucketName) return resolvedBucketName;
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    return process.env.FIREBASE_STORAGE_BUCKET;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfigData.projectId;
  return `${projectId}.appspot.com`;
}

function storageBucketCandidates() {
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfigData.projectId;
  return [...new Set([
    process.env.FIREBASE_STORAGE_BUCKET,
    `${projectId}.appspot.com`,
    `${projectId}.firebasestorage.app`,
  ].filter((name): name is string => Boolean(name)))];
}

export async function getAdminStorage() {
  adminAppPromise ??= initAdminApp();
  await adminAppPromise;
  const { getStorage } = await import('firebase-admin/storage');
  const storage = getStorage();

  if (resolvedBucketName) {
    return storage.bucket(resolvedBucketName);
  }

  const candidates = storageBucketCandidates();
  for (const name of candidates) {
    const bucket = storage.bucket(name);
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        resolvedBucketName = name;
        return bucket;
      }
    } catch {
      // Try the next default Firebase bucket name.
    }
  }

  const createName = candidates[0];
  const bucket = storage.bucket(createName);
  try {
    await bucket.create({ location: 'US' });
    resolvedBucketName = createName;
    return bucket;
  } catch (error: any) {
    throw new Error(
      `Firebase Storage is not available. Open Firebase Console > Storage and create the default bucket, then set FIREBASE_STORAGE_BUCKET in Vercel. ${error?.message || ''}`.trim()
    );
  }
}

export async function ensureMarketplaceStorageCors(origin?: string | null) {
  const bucket = await getAdminStorage();
  const allowedOrigins = [...new Set([
    origin,
    'https://sfgen2.vercel.app',
    'http://localhost:3000',
  ].filter((value): value is string => Boolean(value)))];

  try {
    const [metadata] = await bucket.getMetadata();
    const existing = Array.isArray(metadata.cors) ? metadata.cors : [];
    const hasRequiredOrigins = allowedOrigins.every(allowed =>
      existing.some((rule: any) => Array.isArray(rule.origin) && (rule.origin.includes(allowed) || rule.origin.includes('*')))
    );
    const hasPut = existing.some((rule: any) => Array.isArray(rule.method) && rule.method.includes('PUT'));
    if (hasRequiredOrigins && hasPut) {
      return bucket;
    }

    await bucket.setCorsConfiguration([
      {
        origin: allowedOrigins,
        method: ['GET', 'PUT', 'HEAD', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Content-Disposition', 'x-goog-resumable'],
        maxAgeSeconds: 3600,
      },
    ]);
  } catch (corsError) {
    console.warn('Unable to update Storage CORS automatically.', corsError);
  }

  return bucket;
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
