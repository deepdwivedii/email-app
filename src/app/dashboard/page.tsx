"use client";

import * as React from 'react';
import useSWR from 'swr';
import DomainTable from '@/components/domain-table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GmailIcon, OutlookIcon } from '@/components/icons';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ConnectMailbox() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Connect a Mailbox</CardTitle>
        <CardDescription>
          Connect your Gmail or Outlook account to start managing your email subscriptions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        <Button size="lg" asChild className="w-full sm:w-auto">
          <a href="/api/oauth/google/start">
            <GmailIcon className="mr-2 h-5 w-5" /> Connect Google
          </a>
        </Button>
        <Button size="lg" asChild variant="secondary" className="w-full sm:w-auto">
          <a href="/api/oauth/microsoft/start">
            <OutlookIcon className="mr-2 h-5 w-5" /> Connect Microsoft
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR(user ? '/api/inventory' : null, fetcher);
  const { data: mbData, mutate: mutateMailboxes } = useSWR(user ? '/api/mailboxes' : null, fetcher);
  const domains = data?.domains ?? [];
  const mailboxes = mbData?.mailboxes ?? [];

  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);
  const [lastSynced, setLastSynced] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);
  
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected) {
      toast({ title: 'Mailbox connected', description: `Connected ${connected}.` });
      params.delete('connected');
      const base = window.location.pathname;
      const next = params.toString() ? `${base}?${params.toString()}` : base;
      window.history.replaceState({}, '', next);
    }
  }, [toast]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        await mutate();
        if (j) {
          toast({
            title: 'Sync complete',
            description: `Fetched ${j.gmail + j.outlook} messages${j.errors?.length ? `, ${j.errors.length} errors` : ''}.`,
          });
          if (j.lastSynced) setLastSynced(j.lastSynced);
        } else {
          toast({ title: 'Sync complete' });
          setLastSynced(Date.now());
        }
        router.push('/accounts');
      } else {
        toast({ variant: 'destructive', title: 'Sync failed', description: j?.error || 'Please try again.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync error', description: e?.message || String(e) });
    } finally {
      setSyncing(false);
    }
  };
  
  const setActive = async (id: string) => {
    await fetch('/api/mailboxes/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: id }),
    });
  };
  
  const handleSyncMailbox = async (id: string) => {
    setSyncing(true);
    try {
      await setActive(id);
      let attempts = 0;
      let ok = false;
      let delay = 500;
      while (attempts < 3 && !ok) {
        const res = await fetch('/api/sync', { method: 'POST' });
        ok = res.ok;
        if (!ok) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          attempts++;
        }
      }
      if (ok) {
        await Promise.all([mutate(), mutateMailboxes()]);
        toast({ title: 'Sync complete', description: 'Mailbox synced.' });
      } else {
        toast({ variant: 'destructive', title: 'Sync failed', description: 'Please try reconnecting.' });
      }
    } finally {
      setSyncing(false);
    }
  };
  
  const reconnectUrl = (provider: string) => {
    return provider === 'gmail' ? '/api/oauth/google/start' : '/api/oauth/microsoft/start';
  };

  if (authLoading || (!data && !error && user)) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting
  }

  const hasConnectedMailbox = domains.length > 0;
  
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {hasConnectedMailbox ? (
        <>
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-headline text-xl">Dashboard</h1>
          <Button onClick={handleSync} disabled={syncing} variant="secondary" size="sm">
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
        <div className="mb-4 text-xs text-muted-foreground">
          {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleTimeString()}` : 'Ready to sync.'}
        </div>
        
        <TooltipProvider>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mailboxes.map((m: any) => (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="font-headline text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {m.provider === 'gmail' ? <GmailIcon className="h-5 w-5" /> : <OutlookIcon className="h-5 w-5" />}
                    <span>{m.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                  <span>Last sync {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : '—'}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleSyncMailbox(m.id)} disabled={syncing}>Sync Now</Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={reconnectUrl(m.provider)}><RefreshCw className="mr-1 h-4 w-4" />Reconnect</a>
                    </Button>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        </TooltipProvider>
        </>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">Failed to load inventory. Please try again.</div>
      ) : hasConnectedMailbox ? (
        <DomainTable domains={domains} />
      ) : (
        <ConnectMailbox />
      )}
    </div>
  );
}
