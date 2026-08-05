import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    if (!decoded.role || decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    const { email, tokens } = await request.json();
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }
    const amount = Number(tokens);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid token amount.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();

    const normalized = email.trim().toLowerCase();
    const usersQuery = await db.collection('users').where('email', '==', normalized).limit(1).get();
    if (usersQuery.empty) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const userDoc = usersQuery.docs[0];
    const uid = userDoc.id;

    const walletRef = db.collection('tokenWallets').doc(uid);
    const ledgerRef = db.collection('tokenLedger').doc();

    await db.runTransaction(async transaction => {
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists) {
        transaction.set(walletRef, {
          tokens: amount,
          reservedTokens: 0,
          shareableTokens: 0,
          spentTokens: 0,
          referralCode: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.update(walletRef, {
          tokens: FieldValue.increment(amount),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(ledgerRef, {
        uid,
        type: 'admin_credit',
        tokens: amount,
        adminUid: decoded.uid,
        adminEmail: decoded.email || null,
        recipientEmail: normalized,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to add tokens.' }, { status: 500 });
  }
}
