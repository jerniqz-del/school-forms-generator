'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { TokenSpendPreview } from '@/components/token-wallet-display';
import { marketplaceCartTotal } from '@/lib/marketplace';

export type MarketplaceCartItem = {
  id: string;
  title: string;
  description: string;
  tokenPrice: number;
  fileName: string | null;
  fileSize: number | null;
  coverDownloadUrl: string | null;
  owned: boolean;
};

type MarketplaceCartContextValue = {
  items: MarketplaceCartItem[];
  cartCount: number;
  totalTokens: number;
  isOpen: boolean;
  isLoading: boolean;
  busyProductId: string | null;
  isCheckingOut: boolean;
  openCart: () => void;
  closeCart: () => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string) => Promise<boolean>;
  removeFromCart: (productId: string) => Promise<void>;
  checkout: () => Promise<string[]>;
  isInCart: (productId: string) => boolean;
  checkoutVersion: number;
};

const MarketplaceCartContext = createContext<MarketplaceCartContextValue | null>(null);

export function useMarketplaceCart() {
  const value = useContext(MarketplaceCartContext);
  if (!value) {
    throw new Error('useMarketplaceCart must be used inside MarketplaceCartProvider.');
  }
  return value;
}

export function MarketplaceCartProvider({
  isSignedIn,
  availableTokens,
  freeTokens,
  shareableTokens,
  getAuthHeaders,
  onReloadTokens,
  onPurchaseComplete,
  children,
}: {
  isSignedIn: boolean;
  availableTokens: number;
  freeTokens: number;
  shareableTokens: number;
  getAuthHeaders: () => Promise<{ Authorization: string }>;
  onReloadTokens: () => void;
  onPurchaseComplete: () => void;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<MarketplaceCartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutVersion, setCheckoutVersion] = useState(0);
  const [recentPurchases, setRecentPurchases] = useState<MarketplaceCartItem[]>([]);

  const applyCart = useCallback((nextItems: MarketplaceCartItem[] | undefined) => {
    setItems(Array.isArray(nextItems) ? nextItems : []);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!isSignedIn) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/marketplace/cart', { headers: await getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to load cart.');
      applyCart(data.items);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Cart Error',
        description: error.message || 'Unable to load cart.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [applyCart, getAuthHeaders, isSignedIn, toast]);

  useEffect(() => {
    refreshCart().catch(() => null);
  }, [refreshCart]);

  const addToCart = useCallback(async (productId: string) => {
    if (!isSignedIn) return false;
    setBusyProductId(productId);
    try {
      const res = await fetch('/api/marketplace/cart', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to add to cart.');
      applyCart(data.items);
      setRecentPurchases([]);
      toast({
        variant: 'success',
        title: data.alreadyInCart ? 'Already in Cart' : 'Added to Cart',
        description: data.alreadyInCart
          ? 'This pack is already waiting in your cart.'
          : 'Open your cart when you are ready to check out.',
      });
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could Not Add to Cart',
        description: error.message || 'Unable to add this pack.',
      });
      return false;
    } finally {
      setBusyProductId(null);
    }
  }, [applyCart, getAuthHeaders, isSignedIn, toast]);

  const removeFromCart = useCallback(async (productId: string) => {
    setBusyProductId(productId);
    try {
      const res = await fetch('/api/marketplace/cart', {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to remove from cart.');
      applyCart(data.items);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could Not Update Cart',
        description: error.message || 'Unable to remove this pack.',
      });
    } finally {
      setBusyProductId(null);
    }
  }, [applyCart, getAuthHeaders, toast]);

  const checkout = useCallback(async () => {
    const payableItems = items.filter(item => !item.owned);
    const totalTokens = marketplaceCartTotal(payableItems);
    if (totalTokens > availableTokens) {
      onReloadTokens();
      return [];
    }

    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/marketplace/checkout', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          onReloadTokens();
          return [];
        }
        throw new Error(data?.error || 'Unable to check out.');
      }
      const purchased = Array.isArray(data.purchased) ? data.purchased as string[] : [];
      setRecentPurchases(items.filter(item => purchased.includes(item.id)));
      applyCart([]);
      setCheckoutVersion(current => current + 1);
      onPurchaseComplete();
      toast({
        variant: 'success',
        title: purchased.length ? 'Cart Checked Out' : 'Cart Updated',
        description: purchased.length
          ? `${purchased.length} pack(s) are now in your account.`
          : 'Owned or unavailable packs were removed from your cart.',
      });
      return purchased;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout Failed',
        description: error.message || 'Unable to check out your cart.',
      });
      return [];
    } finally {
      setIsCheckingOut(false);
    }
  }, [applyCart, availableTokens, getAuthHeaders, items, onPurchaseComplete, onReloadTokens, toast]);

  const value = useMemo<MarketplaceCartContextValue>(() => ({
    items,
    cartCount: items.length,
    totalTokens: marketplaceCartTotal(items.filter(item => !item.owned)),
    isOpen,
    isLoading,
    busyProductId,
    isCheckingOut,
    openCart: () => {
      setIsOpen(true);
    },
    closeCart: () => setIsOpen(false),
    refreshCart,
    addToCart,
    removeFromCart,
    checkout,
    isInCart: (productId: string) => items.some(item => item.id === productId),
    checkoutVersion,
  }), [addToCart, busyProductId, checkout, checkoutVersion, isCheckingOut, isLoading, isOpen, items, refreshCart, removeFromCart]);

  const wallet = { tokens: availableTokens, freeTokens, shareableTokens };
  const payableItems = items.filter(item => !item.owned);
  const needsReload = payableItems.length > 0 && value.totalTokens > availableTokens;

  return (
    <MarketplaceCartContext.Provider value={value}>
      {children}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Marketplace cart</SheetTitle>
            <SheetDescription>
              Digital packs stay in your account after checkout. Bronze tokens are used first, then gold.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {isLoading && <p className="text-sm text-muted-foreground">Loading cart…</p>}
            {!isLoading && !items.length && !recentPurchases.length && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Your cart is empty. Add teaching packs from the marketplace.
              </p>
            )}
            {items.map(item => (
              <div key={item.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.owned ? 'Already owned' : item.tokenPrice === 0 ? 'Free' : `${item.tokenPrice} tokens`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => removeFromCart(item.id)}
                    disabled={busyProductId === item.id || isCheckingOut}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove {item.title}</span>
                  </Button>
                </div>
              </div>
            ))}
            {recentPurchases.length > 0 && !items.length && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Ready to download</p>
                {recentPurchases.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <p className="min-w-0 font-medium leading-tight">{item.title}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/marketplace/download?productId=${encodeURIComponent(item.id)}`, {
                            headers: await getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.error || 'Unable to download.');
                          window.location.assign(data.downloadUrl);
                        } catch (error: any) {
                          toast({
                            variant: 'destructive',
                            title: 'Download Failed',
                            description: error.message || 'Unable to download this pack.',
                          });
                        }
                      }}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {payableItems.length > 0 && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{payableItems.length} pack(s)</span>
                <span className="font-semibold">{value.totalTokens} tokens</span>
              </div>
              {value.totalTokens > 0 && <TokenSpendPreview wallet={wallet} cost={value.totalTokens} />}
            </div>
          )}

          {items.length > 0 && (
          <SheetFooter className="mt-4 gap-2 sm:flex-col sm:space-x-0">
            <Button
              className="w-full"
              onClick={() => {
                if (needsReload) {
                  onReloadTokens();
                  return;
                }
                checkout().catch(() => null);
              }}
              disabled={!items.length || isCheckingOut || isLoading}
            >
              {isCheckingOut
                ? 'Checking out…'
                : needsReload
                  ? 'Reload tokens to check out'
                  : value.totalTokens > 0
                    ? `Check out for ${value.totalTokens} tokens`
                    : 'Check out'}
            </Button>
          </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </MarketplaceCartContext.Provider>
  );
}

export function MarketplaceCartButton({ className }: { className?: string }) {
  const { cartCount, openCart } = useMarketplaceCart();
  return (
    <Button variant="outline" size="sm" className={className} onClick={openCart}>
      <ShoppingCart className="size-4" />
      Cart
      {cartCount > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
          {cartCount}
        </Badge>
      )}
    </Button>
  );
}
