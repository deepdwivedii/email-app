"use client";

import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GmailIcon, OutlookIcon } from '@/components/icons';
import { useRequireAuth } from '@/hooks/use-auth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function MailboxesPage() {
  const { user, loading } = useRequireAuth();
  const { data, mutate } = useSWR(user ? '/api/mailboxes' : null, fetcher);
  const mailboxes = data?.mailboxes ?? [];

  if (loading || !user) {
    return null;
  }

  const setActive = async (id: string, mode?: 'merged') => {
    await fetch('/api/mailboxes/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: id, mode }),
    });
  };

  const disconnect = async (id: string) => {
    await fetch(`/api/mailboxes/${encodeURIComponent(id)}/disconnect`, { method: 'POST' });
    await mutate();
  };

  const syncNow = async (id: string) => {
    await setActive(id);
    const res = await fetch('/api/sync', { method: 'POST' });
    if (res.ok) {
      await mutate();
    }
  };

  const reconnectUrl = (provider: string) => {
    return provider === 'gmail' ? '/api/oauth/google/start' : '/api/oauth/microsoft/start';
  };

  const getFrequency = (id: string): string => {
    if (typeof window === 'undefined') return 'manual';
    return localStorage.getItem(`sync:mb:${id}`) || 'manual';
  };
  const setFrequency = (id: string, value: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`sync:mb:${id}`, value);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Mailboxes</CardTitle>
          <CardDescription>Manage connected mailboxes and switch views.</CardDescription>
        </CardHeader>
      </Card>

      <TooltipProvider>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {mailboxes.map((m: any) => (
          <Card key={m.id} className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="font-headline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {m.provider === 'gmail' ? <GmailIcon className="h-5 w-5" /> : <OutlookIcon className="h-5 w-5" />}
                  <span>{m.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{m.provider}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {m.health === 'active' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {m.health === 'active' ? 'Connection healthy' : (m.statusText || 'Connection needs attention')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>Connected {new Date(m.connectedAt).toLocaleDateString()}</span>
                <span className="text-xs">Last sync {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : '—'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setActive(m.id)}>Set Active</Button>
                  <Button variant="ghost" size="sm" onClick={() => disconnect(m.id)}>Disconnect</Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={reconnectUrl(m.provider)}><RefreshCw className="mr-1 h-4 w-4" />Reconnect</a>
                  </Button>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setActive(m.id, 'merged')}>Make Primary</Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => syncNow(m.id)}>Sync Now</Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Frequency</span>
                  <select
                    className="rounded border px-2 py-1 text-xs"
                    defaultValue={getFrequency(m.id)}
                    onChange={(e) => setFrequency(m.id, e.target.value)}
                  >
                    <option value="manual">Manual</option>
                    <option value="15m">15 min</option>
                    <option value="30m">30 min</option>
                    <option value="1h">1 hour</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!mailboxes.length && (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">No mailboxes connected</CardTitle>
              <CardDescription>Use Dashboard to connect Google or Microsoft.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
      </TooltipProvider>

      <Card className="mb-2">
        <CardHeader>
          <CardTitle className="font-headline">Merged View</CardTitle>
          <CardDescription>Switch to a merged view across identities (experimental).</CardDescription>
        </CardHeader>
      </Card>
      <Button onClick={() => setActive(mailboxes[0]?.id || '', 'merged')} disabled={!mailboxes.length}>
        Enable Merged View
      </Button>
    </div>
  );
}
