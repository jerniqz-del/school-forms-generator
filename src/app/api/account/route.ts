import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  getAdminFieldValue,
  getAdminFirestore,
  requireDecodedTokenFromRequest,
} from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAccountDeletionRecordId(email: string) {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

async function deleteQuery(db: any, query: any) {
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((docSnap: any) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

async function releaseReservedTokens(uid: string) {
  const db = await getAdminFirestore();
  const FieldValue = await getAdminFieldValue();
  const reservations = await db
    .collection('tokenReservations')
    .where('uid', '==', uid)
    .where('status', '==', 'reserved')
    .limit(100)
    .get();

  if (reservations.empty) return 0;

  const totalReserved = reservations.docs.reduce((sum: number, docSnap: any) => {
    return sum + Number(docSnap.data()?.tokens || 0);
  }, 0);

  await db.runTransaction(async transaction => {
    const walletRef = db.collection('tokenWallets').doc(uid);
    reservations.docs.forEach((docSnap: any) => {
      transaction.update(docSnap.ref, {
        status: 'released',
        releasedByAccountReset: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (totalReserved > 0) {
      transaction.set(
        walletRef,
        {
          tokens: FieldValue.increment(totalReserved),
          reservedTokens: FieldValue.increment(-totalReserved),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  return totalReserved;
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();

    const releasedTokens = await releaseReservedTokens(decoded.uid);
    await deleteQuery(
      db,
      db.collection('tokenReloads').where('uid', '==', decoded.uid).where('status', '==', 'pending')
    );
    await db.collection('users').doc(decoded.uid).set(
      {
        accountResetAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, releasedTokens });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to reset account.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    const uid = decoded.uid;
    const email = decoded.email?.toLowerCase() || null;
    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const walletSnap = await db.collection('tokenWallets').doc(uid).get();
    const referralCode = walletSnap.data()?.referralCode;

    await Promise.all([
      deleteQuery(db, db.collection('tokenLedger').where('uid', '==', uid)),
      deleteQuery(db, db.collection('tokenReservations').where('uid', '==', uid)),
      deleteQuery(db, db.collection('tokenReloads').where('uid', '==', uid)),
      deleteQuery(db, db.collection('tokenShareClaims').where('senderUid', '==', uid)),
      deleteQuery(db, db.collection('tokenShareClaims').where('recipientUid', '==', uid)),
      deleteQuery(db, db.collection('referralInvites').where('referrerUid', '==', uid)),
    ]);

    if (email) {
      await deleteQuery(db, db.collection('tokenShareClaims').where('recipientEmail', '==', email));
    }

    const batch = db.batch();
    batch.delete(db.collection('tokenWallets').doc(uid));
    batch.delete(db.collection('users').doc(uid));
    batch.delete(db.collection('referralInvites').doc(uid));
    if (referralCode) {
      batch.delete(db.collection('referralCodes').doc(referralCode));
    }
    if (email) {
      batch.set(
        db.collection('accountDeletionRecords').doc(getAccountDeletionRecordId(email)),
        {
          email,
          lastDeletedUid: uid,
          welcomeTokensBlocked: true,
          referralSignupBonusBlocked: true,
          deletedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();

    await deleteQuery(db, db.collection('referralCodes').where('uid', '==', uid));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to delete account.' }, { status: 500 });
  }
}
