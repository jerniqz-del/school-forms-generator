'use client';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/with-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

function AdminPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [tokens, setTokens] = useState<number>(10);
  const [bulkCsv, setBulkCsv] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/token-history');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to load history');
      setHistory(data.items || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTokens(e?: any) {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/admin/add-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tokens }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast({ title: 'Success', description: `Added ${tokens} tokens to ${email}` });
      setEmail('');
      await loadHistory();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || String(e) });
    }
  }

  async function handleBulkGenerate(e?: any) {
    if (e) e.preventDefault();
    const lines = bulkCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return toast({ variant: 'destructive', title: 'Error', description: 'No emails provided' });
    setLoading(true);
    let success = 0;
    let failed: string[] = [];
    for (const ln of lines) {
      const parts = ln.split(',').map(p => p.trim());
      const recipient = parts[0];
      const amt = parts[1] ? Number(parts[1]) : tokens;
      try {
        const res = await fetch('/api/admin/add-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recipient, tokens: amt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed');
        success++;
      } catch (err) {
        failed.push(recipient);
      }
    }
    setLoading(false);
    await loadHistory();
    toast({ title: `Bulk complete`, description: `${success} succeeded, ${failed.length} failed` });
    if (failed.length) console.warn('Failed recipients', failed);
  }

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTokens} className="flex gap-2 mb-4">
            <Input placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Input type="number" value={tokens} onChange={e => setTokens(Number(e.target.value))} className="w-32" />
            <Button type="submit">Add tokens</Button>
          </form>

          <div className="mb-6">
            <p className="mb-2">Bulk CSV (one per line: email,amount). Amount optional (uses above value):</p>
            <textarea value={bulkCsv} onChange={e => setBulkCsv(e.target.value)} className="w-full p-2 border rounded h-32" />
            <div className="flex gap-2 mt-2">
              <Button onClick={handleBulkGenerate} disabled={loading}>Generate Bulk</Button>
              <Button variant="outline" onClick={() => { setBulkCsv(''); }}>Clear</Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Recent Token Ledger (admin)</h3>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th>Time</th>
                    <th>Type</th>
                    <th>Tokens</th>
                    <th>Recipient</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="py-2">{item.createdAt || '-'}</td>
                      <td>{item.type}</td>
                      <td>{item.tokens}</td>
                      <td>{item.recipientEmail || item.uid || '-'}</td>
                      <td>{item.adminEmail || item.adminUid || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin UI disabled
export default function DisabledAdmin() { return null };

