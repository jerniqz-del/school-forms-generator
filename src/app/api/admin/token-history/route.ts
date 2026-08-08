import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, isSuperAdminToken, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatTimestamp(value: any) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    if (!isSuperAdminToken(decoded)) {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    const db = await getAdminFirestore();
    const snapshot = await db.collection('tokenLedger').get();
    const userIds = Array.from(new Set(snapshot.docs.map(docSnap => docSnap.data().uid).filter(Boolean)));
    const userEmails = new Map<string, string>();

    for (let index = 0; index < userIds.length; index += 10) {
      const batch = userIds.slice(index, index + 10);
      const usersSnapshot = await db.collection('users').where('__name__', 'in', batch).get();
      usersSnapshot.docs.forEach(userDoc => {
        const user = userDoc.data();
        if (typeof user.email === 'string') userEmails.set(userDoc.id, user.email);
      });
    }

    const items = snapshot.docs
      .map(docSnap => {
        const item = docSnap.data();
        return {
          id: docSnap.id,
          uid: item.uid || null,
          type: item.type || 'token_event',
          tokens: Number(item.tokens || 0),
          amountPesos: typeof item.amountPesos === 'number' ? item.amountPesos : null,
          studentCount: typeof item.studentCount === 'number' ? item.studentCount : null,
          completedGenerations: typeof item.completedGenerations === 'number' ? item.completedGenerations : null,
          recipientEmail: item.recipientEmail || (item.uid ? userEmails.get(item.uid) : null) || null,
          adminUid: item.adminUid || null,
          adminEmail: item.adminEmail || null,
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

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load admin token history.' }, { status: 500 });
  }
}