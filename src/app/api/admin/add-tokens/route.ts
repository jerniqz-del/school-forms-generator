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
    // Find or create the user doc by email. If not found, we'll create a wallet with a generated uid (use email hash)
    const usersQuery = await db.collection('users').where('email', '==', normalized).limit(1).get();
    let uid: string;

    if (usersQuery.empty) {
      // Create a deterministic doc id for anonymous user wallets based on email hash
      const crypto = await import('crypto');
      const id = crypto.createHash('sha256').update(normalized).digest('hex');
      uid = id;
      // Create a minimal user doc so wallet can reference it
      await db.collection('users').doc(uid).set({ email: normalized, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      const userDoc = usersQuery.docs[0];
      uid = userDoc.id;
    }

    const walletRef = db.collection('tokenWallets').doc(uid);
    const ledgerRef = db.collection('tokenLedger').doc();

    await db.runTransaction(async transaction => {
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists) {
        transaction.set(walletRef, {
          uid,
          email: normalized,
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
