import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const snapshot = await (await getAdminFirestore()).collection('purchases').where('uid', '==', uid).get();
    const ownedProductIds = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return typeof data.productId === 'string' ? data.productId : docSnap.id.replace(`${uid}_`, '');
    });

    return NextResponse.json({ ownedProductIds });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to load purchases.' }, { status });
  }
}
