import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { REFERRAL_REWARD_TOKENS, TOKEN_RELOAD_MIN_PESOS } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1/checkout_sessions';

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Paymongo secret key is missing in environment variables.' }, { status: 500 });
    }

    const { checkoutSessionId } = await request.json();
    if (typeof checkoutSessionId !== 'string' || !checkoutSessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Invalid checkout session.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const reloadRef = db.collection('tokenReloads').doc(checkoutSessionId);
    const reloadSnap = await reloadRef.get();
    if (!reloadSnap.exists || reloadSnap.data()?.uid !== uid) {
      return NextResponse.json({ error: 'Token reload session not found.' }, { status: 404 });
    }

    const reload = reloadSnap.data()!;
    if (reload.status === 'credited') {
      return NextResponse.json({ verified: true, tokens: reload.totalTokens, alreadyCredited: true });
    }

    const response = await fetch(`${PAYMONGO_API_URL}/${encodeURIComponent(checkoutSessionId)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMsg = data?.errors?.[0]?.detail || 'Unable to verify token reload payment.';
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const payments = data?.data?.attributes?.payments ?? [];
    const paidPayment = payments.find((payment: any) => {
      const attrs = payment?.attributes ?? payment;
      return attrs?.status === 'paid' && attrs?.currency === 'PHP' && attrs?.amount >= reload.amountInCentavos;
    });

    if (!paidPayment) {
      return NextResponse.json({ error: 'Payment has not been confirmed yet.' }, { status: 402 });
    }

    let referralRewardTokens = 0;
    await db.runTransaction(async transaction => {
      const freshReload = await transaction.get(reloadRef);
      if (!freshReload.exists || freshReload.data()?.status === 'credited') return;

      const fresh = freshReload.data()!;
      const referralInviteRef = db.collection('referralInvites').doc(uid);
      const referralInviteSnap = await transaction.get(referralInviteRef);
      const referralInvite = referralInviteSnap.data();
      const shouldRewardReferrer =
        referralInviteSnap.exists &&
        referralInvite?.referrerUid &&
        !referralInvite?.referrerRewardGranted &&
        Number(fresh.amountPesos || 0) >= TOKEN_RELOAD_MIN_PESOS;

      transaction.set(
        db.collection('tokenWallets').doc(uid),
        {
          tokens: FieldValue.increment(fresh.totalTokens),
          shareableTokens: FieldValue.increment(fresh.totalTokens),
          lifetimePurchasedTokens: FieldValue.increment(fresh.totalTokens),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (shouldRewardReferrer) {
        referralRewardTokens = Number(referralInvite.referrerRewardTokens || REFERRAL_REWARD_TOKENS);
        transaction.set(
          db.collection('tokenWallets').doc(referralInvite.referrerUid),
          {
            tokens: FieldValue.increment(referralRewardTokens),
            lifetimeReferralRewards: FieldValue.increment(referralRewardTokens),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        transaction.update(referralInviteRef, {
          status: 'reward_granted',
          referrerRewardGranted: true,
          firstReloadCheckoutSessionId: checkoutSessionId,
          firstReloadAmountPesos: fresh.amountPesos,
          firstReloadAt: FieldValue.serverTimestamp(),
          rewardGrantedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(db.collection('tokenLedger').doc(), {
          uid: referralInvite.referrerUid,
          type: 'referral_reward',
          tokens: referralRewardTokens,
          referredUid: uid,
          checkoutSessionId,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else if (referralInviteSnap.exists && !referralInvite?.firstReloadAt) {
        transaction.update(referralInviteRef, {
          status: 'first_reload_completed',
          firstReloadCheckoutSessionId: checkoutSessionId,
          firstReloadAmountPesos: fresh.amountPesos,
          firstReloadAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(reloadRef, {
        status: 'credited',
        creditedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection('tokenLedger').doc(), {
        uid,
        type: 'reload',
        checkoutSessionId,
        tokens: fresh.totalTokens,
        amountPesos: fresh.amountPesos,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ verified: true, tokens: reload.totalTokens, referralRewardTokens });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to verify token reload.' }, { status: 500 });
  }
}
