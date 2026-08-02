import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { REFERRAL_REWARD_TOKENS, TOKEN_RELOAD_MIN_PESOS } from '@/lib/tokens';

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
      .collection('referralInvites')
      .where('referrerUid', '==', uid)
      .limit(100)
      .get();

    const referrals = snapshot.docs.map(docSnap => {
      const referral = docSnap.data();
      return {
        id: docSnap.id,
        referredEmail: referral.referredEmail || null,
        status: referral.status || 'signed_up',
        referrerRewardGranted: Boolean(referral.referrerRewardGranted),
        referrerRewardTokens: Number(referral.referrerRewardTokens || REFERRAL_REWARD_TOKENS),
        signedUpAt: formatTimestamp(referral.signedUpAt),
        firstReloadAt: formatTimestamp(referral.firstReloadAt),
        rewardGrantedAt: formatTimestamp(referral.rewardGrantedAt),
      };
    });

    const rewardGranted = referrals.filter(referral => referral.referrerRewardGranted);
    const firstReloadCompleted = referrals.filter(referral => referral.firstReloadAt);

    return NextResponse.json({
      rewardTokens: REFERRAL_REWARD_TOKENS,
      minimumReloadPesos: TOKEN_RELOAD_MIN_PESOS,
      summary: {
        signedUp: referrals.length,
        firstReloadCompleted: firstReloadCompleted.length,
        rewardGranted: rewardGranted.length,
        pendingRewards: referrals.length - rewardGranted.length,
        totalRewardTokens: rewardGranted.reduce((sum, referral) => sum + referral.referrerRewardTokens, 0),
      },
      referrals,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load referrals.' }, { status: 500 });
  }
}
