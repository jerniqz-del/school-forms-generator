import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { calculateTokenCost } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const { action, reservationId, studentCount } = await request.json();
    const db = getAdminFirestore();
    const walletRef = db.collection('tokenWallets').doc(uid);

    if (action === 'reserve') {
      const count = Number(studentCount);
      if (!Number.isInteger(count) || count <= 0) {
        return NextResponse.json({ error: 'Invalid student count.' }, { status: 400 });
      }

      const tokens = calculateTokenCost(count);
      const createdReservationRef = db.collection('tokenReservations').doc();
      await db.runTransaction(async transaction => {
        const walletSnap = await transaction.get(walletRef);
        const wallet = walletSnap.data();
        const available = Number(wallet?.tokens || 0);

        if (!walletSnap.exists || available < tokens) {
          throw new Error('Insufficient tokens.');
        }

        transaction.update(walletRef, {
          tokens: FieldValue.increment(-tokens),
          reservedTokens: FieldValue.increment(tokens),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(createdReservationRef, {
          uid,
          studentCount: count,
          tokens,
          status: 'reserved',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ reservationId: createdReservationRef.id, tokens });
    }

    if (action === 'release' || action === 'consume') {
      if (typeof reservationId !== 'string') {
        return NextResponse.json({ error: 'Missing reservation ID.' }, { status: 400 });
      }

      const reservationRef = db.collection('tokenReservations').doc(reservationId);
      await db.runTransaction(async transaction => {
        const reservationSnap = await transaction.get(reservationRef);
        if (!reservationSnap.exists) throw new Error('Token reservation not found.');

        const reservation = reservationSnap.data()!;
        if (reservation.uid !== uid) throw new Error('Token reservation does not belong to this account.');
        if (reservation.status !== 'reserved') return;

        const tokens = Number(reservation.tokens || 0);
        if (action === 'release') {
          transaction.update(walletRef, {
            tokens: FieldValue.increment(tokens),
            reservedTokens: FieldValue.increment(-tokens),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          transaction.update(walletRef, {
            reservedTokens: FieldValue.increment(-tokens),
            spentTokens: FieldValue.increment(tokens),
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.set(db.collection('tokenLedger').doc(), {
            uid,
            type: 'generation',
            reservationId,
            tokens: -tokens,
            studentCount: reservation.studentCount,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        transaction.update(reservationRef, {
          status: action === 'release' ? 'released' : 'consumed',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid token action.' }, { status: 400 });
  } catch (error: any) {
    const status = error.message === 'Insufficient tokens.' ? 402 : 500;
    return NextResponse.json({ error: error.message || 'Token operation failed.' }, { status });
  }
}
