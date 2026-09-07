import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { purchaseDocId } from '@/lib/marketplace';
import { applyTokenSpend } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const { productId } = await request.json();
    if (typeof productId !== 'string' || !productId) {
      return NextResponse.json({ error: 'Missing product ID.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const productRef = db.collection('products').doc(productId);
    const walletRef = db.collection('tokenWallets').doc(uid);
    const purchaseRef = db.collection('purchases').doc(purchaseDocId(uid, productId));

    const result = await db.runTransaction(async transaction => {
      const [productSnap, purchaseSnap, walletSnap] = await Promise.all([
        transaction.get(productRef),
        transaction.get(purchaseRef),
        transaction.get(walletRef),
      ]);

      if (!productSnap.exists) {
        throw new Error('Product not found.');
      }

      const product = productSnap.data()!;
      if (product.status !== 'published') {
        throw new Error('This product is not available.');
      }

      if (purchaseSnap.exists) {
        return { alreadyOwned: true, tokensSpent: Number(purchaseSnap.data()?.tokensSpent || 0) };
      }

      const tokenPrice = Number(product.tokenPrice || 0);
      if (tokenPrice < 0 || !Number.isFinite(tokenPrice)) {
        throw new Error('Invalid product price.');
      }

      if (tokenPrice > 0) {
        const spend = applyTokenSpend(walletSnap.data(), tokenPrice);

        transaction.update(walletRef, {
          tokens: spend.next.tokens,
          freeTokens: spend.next.freeTokens,
          shareableTokens: spend.next.shareableTokens,
          spentTokens: FieldValue.increment(tokenPrice),
          spentFreeTokens: FieldValue.increment(spend.bronzeUsed),
          spentShareableTokens: FieldValue.increment(spend.goldUsed),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(db.collection('tokenLedger').doc(), {
          uid,
          type: 'marketplace_purchase',
          productId,
          tokens: -tokenPrice,
          bronzeTokens: -spend.bronzeUsed,
          goldTokens: -spend.goldUsed,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(purchaseRef, {
        uid,
        productId,
        tokensSpent: tokenPrice,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { alreadyOwned: false, tokensSpent: tokenPrice };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = error?.message || 'Unable to purchase product.';
    const status = message === 'Sign in is required.' ? 401
      : message === 'Insufficient tokens.' ? 402
      : message === 'Product not found.' ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
