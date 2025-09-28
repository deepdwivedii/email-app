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
  const domains = data?.domains ?? [];

  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);
  const [lastSynced, setLastSynced] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

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
      } else {
        toast({ variant: 'destructive', title: 'Sync failed', description: j?.error || 'Please try again.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync error', description: e?.message || String(e) });
    } finally {
      setSyncing(false);
    }
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
