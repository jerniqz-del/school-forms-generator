import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminFieldValue, getAdminFirestore, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';
import { FREE_SIGNUP_TOKENS, REFERRAL_REWARD_TOKENS } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildReferralCode(uid: string) {
  return `SFG-${uid.slice(0, 8).toUpperCase()}`;
}

function getEmailDomain(email?: string | null) {
  return email?.split('@')[1]?.toLowerCase() || null;
}

function getAccountDeletionRecordId(email: string) {
  return createHash('sha256').update(email.toLowerCase()).digest('hex');
}

async function ensureWallet(uid: string, email?: string | null, referralCode?: string | null) {
  const db = await getAdminFirestore();
  const FieldValue = await getAdminFieldValue();
  const walletRef = db.collection('tokenWallets').doc(uid);
  const normalizedEmail = email?.toLowerCase() || null;

  await db.runTransaction(async transaction => {
    const walletSnap = await transaction.get(walletRef);
    const ownReferralCode = buildReferralCode(uid);

    if (walletSnap.exists) {
      const wallet = walletSnap.data() || {};
      const currentTokens = Number(wallet.tokens || 0);
      const reservedTokens = Number(wallet.reservedTokens || 0);
      const grantedSignupTokens = Number(wallet.freeSignupTokensGranted || 0);
      const missingSignupTokens = Math.max(0, FREE_SIGNUP_TOKENS - grantedSignupTokens);
      const needsSignupBalanceRepair =
        missingSignupTokens === 0 &&
        currentTokens < FREE_SIGNUP_TOKENS &&
        reservedTokens === 0 &&
        !wallet.signupBalanceRepairGranted &&
        Number(wallet.lifetimePurchasedTokens || 0) === 0 &&
        Number(wallet.lifetimeReferralRewards || 0) === 0 &&
        Number(wallet.spentTokens || 0) === 0 &&
        Number(wallet.sharedTokensReceived || 0) === 0 &&
        Number(wallet.sharedTokensSent || 0) === 0;
      const signupTokensToGrant = needsSignupBalanceRepair
        ? FREE_SIGNUP_TOKENS - currentTokens
        : missingSignupTokens;
      const updateData: Record<string, any> = {
        email: normalizedEmail,
        shareableTokens: Number(wallet.shareableTokens || 0),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (signupTokensToGrant > 0) {
        updateData.tokens = FieldValue.increment(signupTokensToGrant);
        updateData.freeSignupTokensGranted = FREE_SIGNUP_TOKENS;
        if (needsSignupBalanceRepair) {
          updateData.signupBalanceRepairGranted = true;
        }
        transaction.set(db.collection('tokenLedger').doc(), {
          uid,
          type: 'signup_bonus',
          tokens: signupTokensToGrant,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      if (!wallet.referralCode) {
        updateData.referralCode = ownReferralCode;
        transaction.set(db.collection('referralCodes').doc(ownReferralCode), {
          uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(walletRef, updateData, { merge: true });
      return;
    }
    const deletionRecordSnap = normalizedEmail
      ? await transaction.get(db.collection('accountDeletionRecords').doc(getAccountDeletionRecordId(normalizedEmail)))
      : null;
    const hadDeletedAccount = Boolean(deletionRecordSnap?.exists);
    let tokens = hadDeletedAccount ? 0 : FREE_SIGNUP_TOKENS;
    let referredBy: string | null = null;

    if (referralCode && !hadDeletedAccount) {
      const referralSnap = await transaction.get(db.collection('referralCodes').doc(referralCode));
      const referrerUid = referralSnap.exists ? referralSnap.data()?.uid : null;

      if (typeof referrerUid === 'string' && referrerUid && referrerUid !== uid) {
        const referrerWalletSnap = await transaction.get(db.collection('tokenWallets').doc(referrerUid));
        const referrerEmail = referrerWalletSnap.data()?.email;
        const isSameEmail = normalizedEmail && referrerEmail === normalizedEmail;

        if (!isSameEmail) {
          referredBy = referrerUid;
          tokens += REFERRAL_REWARD_TOKENS;
          transaction.set(db.collection('referralInvites').doc(uid), {
            referrerUid,
            referredUid: uid,
            referredEmail: normalizedEmail,
            referredDomain: getEmailDomain(normalizedEmail),
            status: 'signed_up',
            referredRewardGranted: true,
            referrerRewardGranted: false,
            referredRewardTokens: REFERRAL_REWARD_TOKENS,
            referrerRewardTokens: REFERRAL_REWARD_TOKENS,
            createdAt: FieldValue.serverTimestamp(),
            signedUpAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (referredBy) {
        transaction.set(db.collection('tokenLedger').doc(), {
          uid,
          type: 'referral_signup_bonus',
          tokens: REFERRAL_REWARD_TOKENS,
          referrerUid: referredBy,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    transaction.set(walletRef, {
      uid,
      email: normalizedEmail,
      tokens,
      shareableTokens: 0,
      reservedTokens: 0,
      freeSignupTokensGranted: FREE_SIGNUP_TOKENS,
      welcomeTokensBlockedByPriorDeletion: hadDeletedAccount,
      referralCode: ownReferralCode,
      referredBy,
      lifetimePurchasedTokens: 0,
      lifetimeReferralRewards: referredBy ? REFERRAL_REWARD_TOKENS : 0,
      lifetimeGenerationRewards: 0,
      completedGenerations: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.collection('referralCodes').doc(ownReferralCode), {
      uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (tokens > 0) {
      transaction.set(db.collection('tokenLedger').doc(), {
        uid,
        type: 'signup_bonus',
        tokens: FREE_SIGNUP_TOKENS,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else if (hadDeletedAccount) {
      transaction.set(db.collection('tokenLedger').doc(), {
        uid,
        type: 'signup_bonus_blocked',
        tokens: 0,
        reason: 'prior_account_deletion',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  if (normalizedEmail) {
    const pendingShares = await db
      .collection('tokenShareClaims')
      .where('recipientEmail', '==', normalizedEmail)
      .where('status', '==', 'pending')
      .limit(10)
      .get();

    if (!pendingShares.empty) {
      await db.runTransaction(async transaction => {
        let totalSharedTokens = 0;
        pendingShares.docs.forEach(docSnap => {
          const share = docSnap.data();
          totalSharedTokens += Number(share.tokens || 0);
          transaction.update(docSnap.ref, {
            recipientUid: uid,
            status: 'claimed',
            claimedAt: FieldValue.serverTimestamp(),
          });
        });

        if (totalSharedTokens > 0) {
          transaction.set(
            walletRef,
            {
              tokens: FieldValue.increment(totalSharedTokens),
              sharedTokensReceived: FieldValue.increment(totalSharedTokens),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          transaction.set(db.collection('tokenLedger').doc(), {
            uid,
            type: 'share_received',
            tokens: totalSharedTokens,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }
  }

  return walletRef.get();
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    const walletSnap = await ensureWallet(decoded.uid, decoded.email || null);
    return NextResponse.json({ wallet: walletSnap.data() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load wallet.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireDecodedTokenFromRequest(request);
    const { referralCode } = await request.json().catch(() => ({}));
    const walletSnap = await ensureWallet(decoded.uid, decoded.email || null, typeof referralCode === 'string' ? referralCode.trim() : null);
    return NextResponse.json({ wallet: walletSnap.data() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to create wallet.' }, { status: 500 });
  }
}
