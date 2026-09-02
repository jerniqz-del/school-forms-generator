import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage, isSuperAdminToken, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';
import { isAllowedCoverContentType, resolveZipContentType } from '@/lib/marketplace';

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
    const db = await getAdminFirestore();
    const productRef = db.collection('products').doc(id);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const product = productSnap.data()!;
    const formData = await request.formData();
    const zip = formData.get('zip');
    const cover = formData.get('cover');
    const bucket = await getAdminStorage();

    if (zip instanceof File) {
      const contentType = resolveZipContentType(zip.type, zip.name);
      if (!contentType) {
        return NextResponse.json({ error: 'Only zip files are allowed.' }, { status: 400 });
      }
      const buffer = Buffer.from(await zip.arrayBuffer());
      await bucket.file(product.storagePath).save(buffer, {
        resumable: false,
        contentType,
        metadata: { contentType },
      });
    }

    if (cover instanceof File) {
      if (!product.coverStoragePath) {
        return NextResponse.json({ error: 'This product was not created with a cover image.' }, { status: 400 });
      }
      if (!isAllowedCoverContentType(cover.type)) {
        return NextResponse.json({ error: 'Cover must be a JPEG, PNG, or WebP image.' }, { status: 400 });
      }
      const buffer = Buffer.from(await cover.arrayBuffer());
      await bucket.file(product.coverStoragePath).save(buffer, {
        resumable: false,
        contentType: cover.type,
        metadata: { contentType: cover.type },
      });
    }

    if (!(zip instanceof File) && !(cover instanceof File)) {
      return NextResponse.json({ error: 'Attach a zip or cover file.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to upload product files.' }, { status });
  }
}
