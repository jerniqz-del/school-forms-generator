'use client';

import { useState, useCallback, useEffect, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { MARKETPLACE_MAX_ZIP_BYTES } from '@/lib/marketplace';

type AdminProduct = {
  id: string;
  title: string;
  description: string;
  tokenPrice: number;
  fileName: string | null;
  fileSize: number | null;
  status: string;
};

export function AdminMarketplaceProducts({
  user,
  getAuthHeaders,
}: {
  user: User | null;
  getAuthHeaders: () => Promise<{ Authorization: string }>;
}) {
  const { toast } = useToast();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tokenPrice, setTokenPrice] = useState(0);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const loadProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/marketplace/admin/products', { headers: await getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to load products');
      setProducts(data.products || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, toast, user]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function handlePublish(event: FormEvent) {
    event.preventDefault();
    if (!zipFile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Choose a zip file.' });
      return;
    }
    if (zipFile.size > MARKETPLACE_MAX_ZIP_BYTES) {
      toast({ variant: 'destructive', title: 'Error', description: 'Zip files must be 200MB or smaller.' });
      return;
    }

    setSaving(true);
    try {
      const createRes = await fetch('/api/marketplace/admin/products', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          tokenPrice,
          fileName: zipFile.name,
          contentType: zipFile.type || 'application/zip',
          fileSize: zipFile.size,
          coverContentType: coverFile?.type || undefined,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created?.error || 'Unable to create product');

      const zipUpload = await fetch(created.zipUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': created.zipContentType },
        body: zipFile,
      });
      if (!zipUpload.ok) throw new Error('Unable to upload zip file to storage.');

      if (coverFile && created.coverUploadUrl && created.coverContentType) {
        const coverUpload = await fetch(created.coverUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': created.coverContentType },
          body: coverFile,
        });
        if (!coverUpload.ok) throw new Error('Unable to upload cover image to storage.');
      }

      const publishRes = await fetch(`/api/marketplace/admin/products/${created.productId}/publish`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: zipFile.name }),
      });
      const published = await publishRes.json();
      if (!publishRes.ok) throw new Error(published?.error || 'Unable to publish product');

      toast({ title: 'Published', description: `${title} is now in the marketplace.` });
      setTitle('');
      setDescription('');
      setTokenPrice(0);
      setZipFile(null);
      setCoverFile(null);
      await loadProducts();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Marketplace products</h3>
        <Button type="button" variant="outline" onClick={loadProducts} disabled={loading || !user}>
          {loading ? 'Loading…' : 'Refresh list'}
        </Button>
      </div>

      <form onSubmit={handlePublish} className="grid gap-3 rounded-lg border p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="product-title">Title</Label>
            <Input id="product-title" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-tokens">Token price (0 = free)</Label>
            <Input
              id="product-tokens"
              type="number"
              min={0}
              step={1}
              value={tokenPrice}
              onChange={e => setTokenPrice(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-description">Description</Label>
          <textarea
            id="product-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="product-zip">Zip file</Label>
            <Input
              id="product-zip"
              type="file"
              accept=".zip,application/zip"
              onChange={e => setZipFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-cover">Cover image (optional)</Label>
            <Input
              id="product-cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => setCoverFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Upload and publish'}</Button>
      </form>

      <div className="overflow-auto max-h-64">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Title</th>
              <th>Tokens</th>
              <th>Status</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} className="border-t">
                <td className="py-2">{product.title}</td>
                <td>{product.tokenPrice}</td>
                <td>{product.status}</td>
                <td>{product.fileName || '-'}</td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td className="py-2 text-muted-foreground" colSpan={4}>
                  No products yet. Refresh after publishing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
