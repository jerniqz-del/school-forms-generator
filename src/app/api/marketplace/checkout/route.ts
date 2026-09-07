import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { marketplaceCartTotal, purchaseDocId, uniqueCartProductIds } from '@/lib/marketplace';
import { applyTokenSpend } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const cartRef = db.collection('marketplaceCarts').doc(uid);
    const walletRef = db.collection('tokenWallets').doc(uid);

    const result = await db.runTransaction(async transaction => {
      const cartSnap = await transaction.get(cartRef);
      const walletSnap = await transaction.get(walletRef);
      const productIds = uniqueCartProductIds(cartSnap.data()?.productIds);
      if (!productIds.length) {
        throw new Error('Your cart is empty.');
      }

      const productSnaps = await Promise.all(
        productIds.map(productId => transaction.get(db.collection('products').doc(productId)))
      );
      const purchaseSnaps = await Promise.all(
        productIds.map(productId => transaction.get(db.collection('purchases').doc(purchaseDocId(uid, productId))))
      );

      const purchasable: Array<{ productId: string; tokenPrice: number }> = [];
      const alreadyOwned: string[] = [];
      const unavailable: string[] = [];

      productIds.forEach((productId, index) => {
        const productSnap = productSnaps[index];
        const purchaseSnap = purchaseSnaps[index];
        if (purchaseSnap.exists) {
          alreadyOwned.push(productId);
          return;
        }
        if (!productSnap.exists || productSnap.data()?.status !== 'published') {
          unavailable.push(productId);
          return;
        }
        const tokenPrice = Number(productSnap.data()?.tokenPrice || 0);
        if (tokenPrice < 0 || !Number.isFinite(tokenPrice)) {
          throw new Error('Invalid product price.');
        }
        purchasable.push({ productId, tokenPrice: Math.floor(tokenPrice) });
      });

      if (!purchasable.length) {
        transaction.set(
          cartRef,
          { uid, productIds: [], updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return {
          purchased: [] as string[],
          alreadyOwned,
          unavailable,
          tokensSpent: 0,
          bronzeTokens: 0,
          goldTokens: 0,
        };
      }

      const tokensSpent = marketplaceCartTotal(purchasable);
      let bronzeTokens = 0;
      let goldTokens = 0;
      if (tokensSpent > 0) {
        const spend = applyTokenSpend(walletSnap.data(), tokensSpent);
        bronzeTokens = spend.bronzeUsed;
        goldTokens = spend.goldUsed;
        transaction.update(walletRef, {
          tokens: spend.next.tokens,
          freeTokens: spend.next.freeTokens,
          shareableTokens: spend.next.shareableTokens,
          spentTokens: FieldValue.increment(tokensSpent),
          spentFreeTokens: FieldValue.increment(spend.bronzeUsed),
          spentShareableTokens: FieldValue.increment(spend.goldUsed),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      purchasable.forEach(item => {
        transaction.set(db.collection('purchases').doc(purchaseDocId(uid, item.productId)), {
          uid,
          productId: item.productId,
          tokensSpent: item.tokenPrice,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      if (tokensSpent > 0) {
        transaction.set(db.collection('tokenLedger').doc(), {
          uid,
          type: 'marketplace_purchase',
          productIds: purchasable.map(item => item.productId),
          tokens: -tokensSpent,
          bronzeTokens: -bronzeTokens,
          goldTokens: -goldTokens,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(
        cartRef,
        { uid, productIds: [], updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      return {
        purchased: purchasable.map(item => item.productId),
        alreadyOwned,
        unavailable,
        tokensSpent,
        bronzeTokens,
        goldTokens,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = error?.message || 'Unable to check out cart.';
    const status = message === 'Sign in is required.' ? 401
      : message === 'Insufficient tokens.' ? 402
      : message === 'Your cart is empty.' ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
