import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { MARKETPLACE_DOWNLOAD_URL_TTL_MS, purchaseDocId } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const productId = request.nextUrl.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json({ error: 'Missing product ID.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const productSnap = await db.collection('products').doc(productId).get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const product = productSnap.data()!;
    if (product.status !== 'published') {
      return NextResponse.json({ error: 'This product is not available.' }, { status: 404 });
    }

    const purchaseSnap = await db.collection('purchases').doc(purchaseDocId(uid, productId)).get();
    if (!purchaseSnap.exists) {
      return NextResponse.json({ error: 'Purchase this product before downloading.' }, { status: 403 });
    }

    const storagePath = product.storagePath as string;
    if (!storagePath) {
      return NextResponse.json({ error: 'Product file is missing.' }, { status: 500 });
    }

    const bucket = await getAdminStorage();
    const fileName = product.fileName || 'product.zip';
    const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + MARKETPLACE_DOWNLOAD_URL_TTL_MS,
      responseDisposition: `attachment; filename="${String(fileName).replace(/"/g, '')}"`,
    });

    return NextResponse.json({ downloadUrl, fileName });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to download product.' }, { status });
  }
}
