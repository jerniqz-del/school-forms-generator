'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TokenBalanceChips } from '@/components/token-wallet-display';
import { MarketplaceCartButton, useMarketplaceCart } from '@/components/marketplace/marketplace-cart';

type MarketplaceProduct = {
  id: string;
  title: string;
  description: string;
  tokenPrice: number;
  fileName: string | null;
  fileSize: number | null;
  coverDownloadUrl: string | null;
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MarketplaceSection({
  isSignedIn,
  availableTokens,
  freeTokens,
  shareableTokens,
  getAuthHeaders,
  onSignIn,
}: {
  isSignedIn: boolean;
  availableTokens: number;
  freeTokens: number;
  shareableTokens: number;
  getAuthHeaders: () => Promise<{ Authorization: string }>;
  onSignIn: () => void;
}) {
  const { addToCart, isInCart, openCart, busyProductId, checkoutVersion } = useMarketplaceCart();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [ownedProductIds, setOwnedProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingProductId, setDownloadingProductId] = useState<string | null>(null);
  const wallet = { tokens: availableTokens, freeTokens, shareableTokens };

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const productsRes = await fetch('/api/marketplace/products');
      const productsData = await productsRes.json();
      if (!productsRes.ok) throw new Error(productsData?.error || 'Unable to load marketplace.');
      setProducts(productsData.products || []);

      if (isSignedIn) {
        const purchasesRes = await fetch('/api/marketplace/purchases', { headers: await getAuthHeaders() });
        const purchasesData = await purchasesRes.json();
        if (purchasesRes.ok) {
          setOwnedProductIds(new Set(purchasesData.ownedProductIds || []));
        }
      } else {
        setOwnedProductIds(new Set());
      }
    } catch (e: any) {
      setError(e.message || 'Unable to load marketplace.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isSignedIn]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!checkoutVersion || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const purchasesRes = await fetch('/api/marketplace/purchases', { headers: await getAuthHeaders() });
        const purchasesData = await purchasesRes.json();
        if (!cancelled && purchasesRes.ok) {
          setOwnedProductIds(new Set(purchasesData.ownedProductIds || []));
        }
      } catch {
        // Catalog refresh is best-effort after checkout.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkoutVersion, getAuthHeaders, isSignedIn]);

  async function downloadProduct(productId: string) {
    const res = await fetch(`/api/marketplace/download?productId=${encodeURIComponent(productId)}`, {
      headers: await getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to download.');
    window.location.assign(data.downloadUrl);
  }

  async function handleProductAction(product: MarketplaceProduct) {
    if (!isSignedIn) {
      onSignIn();
      return;
    }

    setError(null);
    try {
      if (ownedProductIds.has(product.id)) {
        setDownloadingProductId(product.id);
        await downloadProduct(product.id);
        return;
      }
      if (isInCart(product.id)) {
        openCart();
        return;
      }
      await addToCart(product.id);
    } catch (e: any) {
      setError(e.message || 'Unable to update your cart.');
    } finally {
      setDownloadingProductId(null);
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-lg shadow-primary/5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3">Marketplace</Badge>
          <h2 className="text-3xl font-bold tracking-normal">Teaching materials marketplace</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Add classroom packs to your cart, then check out with your token wallet. Bronze free and reward tokens are used first, then gold reload tokens. Paid packs stay in your account so you can download them again.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {isSignedIn && (
            <div className="rounded-2xl border bg-muted/40 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Wallet for checkout</p>
              <TokenBalanceChips wallet={wallet} />
            </div>
          )}
          {isSignedIn && <MarketplaceCartButton />}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-6 text-sm text-muted-foreground">Loading materials…</p>}

      {!loading && !products.length && (
        <p className="mt-6 text-muted-foreground">No materials are listed yet. Check back after new packs are published.</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map(product => {
          const owned = ownedProductIds.has(product.id);
          const inCart = isInCart(product.id);
          const busy = busyProductId === product.id || downloadingProductId === product.id;
          return (
            <Card key={product.id} className="overflow-hidden">
              {product.coverDownloadUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.coverDownloadUrl} alt="" className="h-36 w-full object-cover" />
              )}
              <CardHeader>
                <CardTitle className="text-lg">{product.title}</CardTitle>
                <CardDescription>
                  {product.tokenPrice === 0 ? 'Free' : `${product.tokenPrice} tokens`}
                  {product.fileSize ? ` · ${formatFileSize(product.fileSize)}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.description && (
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                )}
                <Button className="w-full" onClick={() => handleProductAction(product)} disabled={busy}>
                  {busy
                    ? 'Working…'
                    : !isSignedIn
                      ? 'Sign in to get'
                      : owned
                        ? 'Download'
                        : inCart
                          ? 'View cart'
                          : product.tokenPrice === 0
                            ? 'Add free pack to cart'
                            : `Add to cart · ${product.tokenPrice} tokens`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
