import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const { recipientEmail, tokens } = await request.json();
    const amount = Number(tokens);

    if (typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid recipient email.' }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid token amount.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const senderRef = db.collection('tokenWallets').doc(uid);
    const normalizedEmail = recipientEmail.trim().toLowerCase();

    await db.runTransaction(async transaction => {
      const senderSnap = await transaction.get(senderRef);
      const senderTokens = Number(senderSnap.data()?.tokens || 0);
      if (!senderSnap.exists || senderTokens < amount) {
        throw new Error('Insufficient tokens.');
      }

      transaction.update(senderRef, {
        tokens: FieldValue.increment(-amount),
        sharedTokensSent: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection('tokenShareClaims').doc(), {
        senderUid: uid,
        recipientEmail: normalizedEmail,
        tokens: amount,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection('tokenLedger').doc(), {
        uid,
        type: 'share_sent',
        recipientEmail: normalizedEmail,
        tokens: -amount,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = error.message === 'Insufficient tokens.' ? 402 : 500;
    return NextResponse.json({ error: error.message || 'Unable to share tokens.' }, { status });
  }
}
