"use client";

import * as React from 'react';
import useSWR from 'swr';
import DomainTable from '@/components/domain-table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/inventory', fetcher);
  const domains = data?.domains ?? [];

  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);
  const [lastSynced, setLastSynced] = React.useState<number | null>(null);

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

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-headline text-xl">Dashboard</h1>
        <Button onClick={handleSync} disabled={syncing} variant="secondary" size="sm">
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>
      <div className="mb-4 text-xs text-muted-foreground">
        {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleTimeString()}` : 'Not synced yet'}
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">Failed to load inventory</div>
      ) : (
        <DomainTable domains={domains} />
      )}
    </div>
  );
}