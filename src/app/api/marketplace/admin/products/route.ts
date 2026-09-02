import { NextRequest, NextResponse } from 'next/server';
import { ensureMarketplaceStorageCors, getAdminFieldValue, getAdminFirestore, isSuperAdminToken, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';
import {
  coverExtensionForContentType,
  isAllowedCoverContentType,
  marketplaceCoverPath,
  marketplaceZipPath,
  MARKETPLACE_MAX_ZIP_BYTES,
  MARKETPLACE_UPLOAD_URL_TTL_MS,
  resolveZipContentType,
  sanitizeZipFileName,
} from '@/lib/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    if (!isSuperAdminToken(decoded)) {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    const db = await getAdminFirestore();
    const snapshot = await db.collection('products').get();
    const products = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        tokenPrice: Number(data.tokenPrice || 0),
        fileName: data.fileName || null,
        fileSize: typeof data.fileSize === 'number' ? data.fileSize : null,
        storagePath: data.storagePath || '',
        coverStoragePath: data.coverStoragePath || null,
        status: data.status || 'draft',
        createdBy: data.createdBy || null,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ products });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to list products.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    if (!isSuperAdminToken(decoded)) {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const tokenPrice = Number(body.tokenPrice);
    const fileName = typeof body.fileName === 'string' ? sanitizeZipFileName(body.fileName) : 'product.zip';
    const requestedZipType = typeof body.contentType === 'string' ? body.contentType : '';
    const zipContentType = resolveZipContentType(requestedZipType, fileName);
    const fileSize = Number(body.fileSize);
    const coverContentType = typeof body.coverContentType === 'string' ? body.coverContentType : undefined;

    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }
    if (!Number.isFinite(tokenPrice) || tokenPrice < 0 || !Number.isInteger(tokenPrice)) {
      return NextResponse.json({ error: 'Token price must be a whole number of 0 or more.' }, { status: 400 });
    }
    if (!zipContentType) {
      return NextResponse.json({ error: 'Only zip files are allowed.' }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MARKETPLACE_MAX_ZIP_BYTES) {
      return NextResponse.json({ error: 'Zip must be between 1 byte and 200MB.' }, { status: 400 });
    }
    if (coverContentType && !isAllowedCoverContentType(coverContentType)) {
      return NextResponse.json({ error: 'Cover must be a JPEG, PNG, or WebP image.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const productRef = db.collection('products').doc();
    const storagePath = marketplaceZipPath(productRef.id);
    const coverStoragePath = coverContentType
      ? marketplaceCoverPath(productRef.id, coverExtensionForContentType(coverContentType))
      : null;

    await productRef.set({
      title,
      description,
      tokenPrice,
      fileName,
      fileSize: null,
      storagePath,
      coverStoragePath,
      status: 'draft',
      createdBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const bucket = await ensureMarketplaceStorageCors(request.headers.get('origin'));
    const expires = Date.now() + MARKETPLACE_UPLOAD_URL_TTL_MS;
    const [zipUploadUrl] = await bucket.file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType: zipContentType,
    });

    let coverUploadUrl: string | null = null;
    if (coverStoragePath && coverContentType) {
      const [url] = await bucket.file(coverStoragePath).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires,
        contentType: coverContentType,
      });
      coverUploadUrl = url;
    }

    return NextResponse.json({
      productId: productRef.id,
      zipUploadUrl,
      zipContentType,
      coverUploadUrl,
      coverContentType: coverContentType || null,
    });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to create product.' }, { status });
  }
}
