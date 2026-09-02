import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, getAdminStorage, isSuperAdminToken, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    if (!isSuperAdminToken(decoded)) {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const fileName = typeof body.fileName === 'string' ? body.fileName : undefined;

    const db = await getAdminFirestore();
    const productRef = db.collection('products').doc(id);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const product = productSnap.data()!;
    const storagePath = product.storagePath as string;
    if (!storagePath) {
      return NextResponse.json({ error: 'Product is missing a storage path.' }, { status: 400 });
    }

    const bucket = await getAdminStorage();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Upload the zip file before publishing.' }, { status: 400 });
    }

    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);
    if (!fileSize) {
      return NextResponse.json({ error: 'Uploaded zip is empty.' }, { status: 400 });
    }

    if (product.coverStoragePath) {
      const [coverExists] = await bucket.file(product.coverStoragePath).exists();
      if (!coverExists) {
        return NextResponse.json({ error: 'Upload the cover image before publishing.' }, { status: 400 });
      }
    }

    const FieldValue = await getAdminFieldValue();
    await productRef.update({
      status: 'published',
      fileSize,
      fileName: fileName || product.fileName || 'product.zip',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, fileSize });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to publish product.' }, { status });
  }
}
