import { NextRequest, NextResponse } from 'next/server';
import { getAdminFieldValue, getAdminFirestore, getAdminStorage, requireUserIdFromRequest } from '@/lib/firebase-admin';
import {
  MARKETPLACE_COVER_URL_TTL_MS,
  MARKETPLACE_MAX_CART_ITEMS,
  marketplaceCartTotal,
  purchaseDocId,
  uniqueCartProductIds,
} from '@/lib/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CartItem = {
  id: string;
  title: string;
  description: string;
  tokenPrice: number;
  fileName: string | null;
  fileSize: number | null;
  coverDownloadUrl: string | null;
  owned: boolean;
};

async function loadCartItems(uid: string, productIds: string[]): Promise<CartItem[]> {
  if (!productIds.length) return [];

  const db = await getAdminFirestore();
  const bucket = await getAdminStorage();
  const coverExpires = Date.now() + MARKETPLACE_COVER_URL_TTL_MS;

  const items = await Promise.all(productIds.map(async productId => {
    const [productSnap, purchaseSnap] = await Promise.all([
      db.collection('products').doc(productId).get(),
      db.collection('purchases').doc(purchaseDocId(uid, productId)).get(),
    ]);
    if (!productSnap.exists) return null;
    const data = productSnap.data()!;
    if (data.status !== 'published') return null;

    let coverDownloadUrl: string | null = null;
    if (data.coverStoragePath) {
      const [url] = await bucket.file(data.coverStoragePath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: coverExpires,
      });
      coverDownloadUrl = url;
    }

    return {
      id: productSnap.id,
      title: data.title || '',
      description: data.description || '',
      tokenPrice: Number(data.tokenPrice || 0),
      fileName: data.fileName || null,
      fileSize: typeof data.fileSize === 'number' ? data.fileSize : null,
      coverDownloadUrl,
      owned: purchaseSnap.exists,
    } satisfies CartItem;
  }));

  return items.filter((item): item is CartItem => Boolean(item));
}

export async function GET(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const cartSnap = await (await getAdminFirestore()).collection('marketplaceCarts').doc(uid).get();
    const productIds = uniqueCartProductIds(cartSnap.data()?.productIds);
    const items = await loadCartItems(uid, productIds);
    return NextResponse.json({
      items,
      totalTokens: marketplaceCartTotal(items.filter(item => !item.owned)),
    });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to load cart.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const { productId } = await request.json();
    if (typeof productId !== 'string' || !productId.trim()) {
      return NextResponse.json({ error: 'Missing product ID.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const cartRef = db.collection('marketplaceCarts').doc(uid);
    const productRef = db.collection('products').doc(productId);
    const purchaseRef = db.collection('purchases').doc(purchaseDocId(uid, productId));

    const result = await db.runTransaction(async transaction => {
      const [cartSnap, productSnap, purchaseSnap] = await Promise.all([
        transaction.get(cartRef),
        transaction.get(productRef),
        transaction.get(purchaseRef),
      ]);

      if (!productSnap.exists || productSnap.data()?.status !== 'published') {
        throw new Error('This product is not available.');
      }
      if (purchaseSnap.exists) {
        throw new Error('You already own this product.');
      }

      const productIds = uniqueCartProductIds(cartSnap.data()?.productIds);
      if (productIds.includes(productId)) {
        return { alreadyInCart: true, productIds };
      }
      if (productIds.length >= MARKETPLACE_MAX_CART_ITEMS) {
        throw new Error(`Cart can hold up to ${MARKETPLACE_MAX_CART_ITEMS} packs.`);
      }

      const nextIds = [...productIds, productId];
      transaction.set(
        cartRef,
        {
          uid,
          productIds: nextIds,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { alreadyInCart: false, productIds: nextIds };
    });

    const items = await loadCartItems(uid, result.productIds);
    return NextResponse.json({
      ok: true,
      alreadyInCart: result.alreadyInCart,
      items,
      totalTokens: marketplaceCartTotal(items.filter(item => !item.owned)),
    });
  } catch (error: any) {
    const message = error?.message || 'Unable to add to cart.';
    const status = message === 'Sign in is required.' ? 401
      : message === 'This product is not available.' ? 404
      : message === 'You already own this product.' || message.startsWith('Cart can hold') ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const clear = Boolean(body?.clear);
    const productId = typeof body?.productId === 'string' ? body.productId : null;
    if (!clear && !productId) {
      return NextResponse.json({ error: 'Missing product ID.' }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const FieldValue = await getAdminFieldValue();
    const cartRef = db.collection('marketplaceCarts').doc(uid);
    const cartSnap = await cartRef.get();
    const currentIds = uniqueCartProductIds(cartSnap.data()?.productIds);
    const nextIds = clear ? [] : currentIds.filter(id => id !== productId);

    await cartRef.set(
      {
        uid,
        productIds: nextIds,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const items = await loadCartItems(uid, nextIds);
    return NextResponse.json({
      ok: true,
      items,
      totalTokens: marketplaceCartTotal(items.filter(item => !item.owned)),
    });
  } catch (error: any) {
    const status = error?.message === 'Sign in is required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to update cart.' }, { status });
  }
}
