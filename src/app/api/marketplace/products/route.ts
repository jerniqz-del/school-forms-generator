import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase-admin';
import { MARKETPLACE_COVER_URL_TTL_MS } from '@/lib/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getAdminFirestore();
    const snapshot = await db.collection('products').where('status', '==', 'published').get();
    const bucket = await getAdminStorage();
    const coverExpires = Date.now() + MARKETPLACE_COVER_URL_TTL_MS;

    const products = await Promise.all(snapshot.docs.map(async docSnap => {
      const data = docSnap.data();
      let coverDownloadUrl: string | null = null;
      if (data.coverStoragePath) {
        const [url] = await bucket.file(data.coverStoragePath).getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: coverExpires,
        });
        coverDownloadUrl = url;
      }

      return {
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        tokenPrice: Number(data.tokenPrice || 0),
        fileName: data.fileName || null,
        fileSize: typeof data.fileSize === 'number' ? data.fileSize : null,
        coverDownloadUrl,
        status: 'published' as const,
      };
    }));

    products.sort((a, b) => a.title.localeCompare(b.title));
    return NextResponse.json({ products });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load marketplace products.' }, { status: 500 });
  }
}
