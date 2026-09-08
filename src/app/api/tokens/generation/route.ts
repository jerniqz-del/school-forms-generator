import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import {
  applyTokenSpend,
  calculateTokenCost,
  creditFreeTokens,
  generationRewardFromGoldSpend,
  readTokenBalances,
  reservationReleaseAmounts,
} from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const { action, reservationId, studentCount } = await request.json();
    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
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
        const spend = applyTokenSpend(walletSnap.data(), tokens);

        transaction.update(walletRef, {
          tokens: spend.next.tokens,
          freeTokens: spend.next.freeTokens,
          shareableTokens: spend.next.shareableTokens,
          reservedTokens: FieldValue.increment(tokens),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(createdReservationRef, {
          uid,
          studentCount: count,
          tokens,
          bronzeTokens: spend.bronzeUsed,
          goldTokens: spend.goldUsed,
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
      let rewardTokens = 0;
      await db.runTransaction(async transaction => {
        const reservationSnap = await transaction.get(reservationRef);
        if (!reservationSnap.exists) throw new Error('Token reservation not found.');

        const reservation = reservationSnap.data()!;
        if (reservation.uid !== uid) throw new Error('Token reservation does not belong to this account.');
        if (reservation.status !== 'reserved') return;

        const tokens = Number(reservation.tokens || 0);
        const release = reservationReleaseAmounts(reservation);
        if (action === 'release') {
          const walletSnap = await transaction.get(walletRef);
          const current = readTokenBalances(walletSnap.data());
          transaction.update(walletRef, {
            tokens: current.tokens + release.tokens,
            freeTokens: current.freeTokens + release.freeTokens,
            shareableTokens: current.shareableTokens + release.shareableTokens,
            reservedTokens: FieldValue.increment(-tokens),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const walletSnap = await transaction.get(walletRef);
          const wallet = walletSnap.data() || {};
          const studentCountValue = Number(reservation.studentCount || 0);
          const goldSpentNow = release.shareableTokens;
          const reward = generationRewardFromGoldSpend(
            wallet.goldGenerationTokensSpent,
            goldSpentNow,
          );
          rewardTokens = reward.rewardTokens;
          const rewarded = creditFreeTokens(wallet, rewardTokens);

          transaction.update(walletRef, {
            tokens: rewarded.tokens,
            freeTokens: rewarded.freeTokens,
            shareableTokens: rewarded.shareableTokens,
            reservedTokens: FieldValue.increment(-tokens),
            spentTokens: FieldValue.increment(tokens),
            spentFreeTokens: FieldValue.increment(release.freeTokens),
            spentShareableTokens: FieldValue.increment(release.shareableTokens),
            goldGenerationTokensSpent: reward.nextGoldSpent,
            completedGenerations: FieldValue.increment(studentCountValue),
            lifetimeGenerationRewards: FieldValue.increment(rewardTokens),
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.set(db.collection('tokenLedger').doc(), {
            uid,
            type: 'generation',
            reservationId,
            tokens: -tokens,
            bronzeTokens: -release.freeTokens,
            goldTokens: -release.shareableTokens,
            studentCount: reservation.studentCount,
            createdAt: FieldValue.serverTimestamp(),
          });
          if (rewardTokens > 0) {
            transaction.set(db.collection('tokenLedger').doc(), {
              uid,
              type: 'generation_reward',
              reservationId,
              tokens: rewardTokens,
              bronzeTokens: rewardTokens,
              goldTokens: 0,
              studentCount: studentCountValue,
              completedGenerations: reward.goldPaidGenerations,
              goldPaidGenerations: reward.goldPaidGenerations,
              goldGenerationTokensSpent: reward.nextGoldSpent,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }

        transaction.update(reservationRef, {
          status: action === 'release' ? 'released' : 'consumed',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ ok: true, rewardTokens });
    }

    return NextResponse.json({ error: 'Invalid token action.' }, { status: 400 });
  } catch (error: any) {
    const status = error.message === 'Insufficient tokens.' ? 402 : 500;
    return NextResponse.json({ error: error.message || 'Token operation failed.' }, { status });
  }
}
