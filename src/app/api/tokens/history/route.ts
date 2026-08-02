import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatTimestamp(value: any) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const db = await getAdminFirestore();
    const snapshot = await db
      .collection('tokenLedger')
      .where('uid', '==', uid)
      .limit(100)
      .get();

    const history = snapshot.docs
      .map(docSnap => {
        const item = docSnap.data();
        return {
          id: docSnap.id,
          type: item.type || 'token_event',
          tokens: Number(item.tokens || 0),
          amountPesos: typeof item.amountPesos === 'number' ? item.amountPesos : null,
          studentCount: typeof item.studentCount === 'number' ? item.studentCount : null,
          completedGenerations: typeof item.completedGenerations === 'number' ? item.completedGenerations : null,
          recipientEmail: item.recipientEmail || null,
          referrerUid: item.referrerUid || null,
          referredUid: item.referredUid || null,
          checkoutSessionId: item.checkoutSessionId || null,
          reservationId: item.reservationId || null,
          createdAt: formatTimestamp(item.createdAt),
          createdAtMillis: typeof item.createdAt?.toMillis === 'function' ? item.createdAt.toMillis() : 0,
        };
      })
      .sort((a, b) => b.createdAtMillis - a.createdAtMillis)
      .map(({ createdAtMillis, ...item }) => item);

    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load token history.' }, { status: 500 });
  }
}
