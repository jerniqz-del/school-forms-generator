'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  getAuthHeaders,
  onSignIn,
  onReloadTokens,
  onPurchaseComplete,
}: {
  isSignedIn: boolean;
  availableTokens: number;
  getAuthHeaders: () => Promise<{ Authorization: string }>;
  onSignIn: () => void;
  onReloadTokens: () => void;
  onPurchaseComplete: () => void;
}) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [ownedProductIds, setOwnedProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

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

  async function downloadProduct(productId: string) {
    const res = await fetch(`/api/marketplace/download?productId=${encodeURIComponent(productId)}`, {
      headers: await getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to download.');
    window.location.assign(data.downloadUrl);
  }

  async function handleBuyOrDownload(product: MarketplaceProduct) {
    if (!isSignedIn) {
      onSignIn();
      return;
    }

    setBusyProductId(product.id);
    setError(null);
    try {
      if (!ownedProductIds.has(product.id)) {
        if (product.tokenPrice > availableTokens) {
          onReloadTokens();
          return;
        }
        const res = await fetch('/api/marketplace/purchase', {
          method: 'POST',
          headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 402) {
            onReloadTokens();
            return;
          }
          throw new Error(data?.error || 'Unable to purchase.');
        }
        setOwnedProductIds(current => new Set(current).add(product.id));
        onPurchaseComplete();
      }
      await downloadProduct(product.id);
    } catch (e: any) {
      setError(e.message || 'Unable to complete purchase.');
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-lg shadow-primary/5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3">Marketplace</Badge>
          <h2 className="text-3xl font-bold tracking-normal">Teaching materials marketplace</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Buy classroom resources with your token wallet. Paid packs stay in your account so you can download them again.
          </p>
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
          const busy = busyProductId === product.id;
          const needsReload = isSignedIn && !owned && product.tokenPrice > availableTokens;
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
                <Button className="w-full" onClick={() => handleBuyOrDownload(product)} disabled={busy}>
                  {busy
                    ? 'Working…'
                    : !isSignedIn
                      ? 'Sign in to get'
                      : owned
                        ? 'Download'
                        : needsReload
                          ? 'Reload tokens'
                          : product.tokenPrice === 0
                            ? 'Get free pack'
                            : `Buy for ${product.tokenPrice} tokens`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
