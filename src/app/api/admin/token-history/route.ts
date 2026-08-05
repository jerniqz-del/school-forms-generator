import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    if (!decoded.role || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    let items: any[] = [];
    try {
      const db = await getAdminFirestore();
      const snapshot = await db.collection('tokenLedger').orderBy('createdAt', 'desc').limit(200).get();

      items = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid || null,
          type: data.type || null,
          tokens: typeof data.tokens === 'number' ? data.tokens : null,
          recipientEmail: data.recipientEmail || null,
          adminUid: data.adminUid || null,
          adminEmail: data.adminEmail || null,
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : null,
        };
      });
    } catch (e: any) {
      // Admin Firestore likely not configured in this environment; return empty list so UI can still render
      return NextResponse.json({ items: [], warning: 'Admin not configured on server.' });
    }

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load token history.' }, { status: 500 });
  }
}
