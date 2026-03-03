"use client";

import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { EmptyState } from '@/components/empty-state';
import { ShieldCheck } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const categories = ['all','bank','social','ecommerce','saas','subscription','other'] as const;

export default function AccountsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [category, setCategory] = React.useState<(typeof categories)[number]>('all');
  const [identity, setIdentity] = React.useState<string>('all');
  const { data: identitiesData } = useSWR(user ? '/api/mailboxes' : null, fetcher);
  const identities = identitiesData?.identities ?? [];
  const mbForIdentity = (mailboxId: string | undefined) => {
    if (!mailboxId) return undefined;
    const mbs = identitiesData?.mailboxes ?? [];
    return mbs.find((m: any) => m.id === mailboxId);
  };
  const identityLabel = (emailIdentityId: string | undefined) => {
    if (!emailIdentityId) return '';
    const match = identities.find((i: any) => i.id === emailIdentityId);
    if (!match) return '';
    const mailboxId = match.mailboxid as string | undefined;
    const mb = mbForIdentity(mailboxId);
    if (!mb) return match.email;
    return (mb.displayName as string | undefined) || (mb.email as string);
  };
  const queryA = category !== 'all' ? `category=${category}` : '';
  const queryB = identity !== 'all' ? `emailIdentityId=${encodeURIComponent(identity)}` : '';
  const query = [queryA, queryB].filter(Boolean).join('&');
  const accountsKey = user ? `/api/accounts${query ? `?${query}` : ''}` : null;
  const { data } = useSWR(accountsKey, fetcher);
  const accounts = data?.accounts ?? [];

  if (!loading && !user) {
    router.push('/auth?from=/accounts');
    return null;
  }

  const onUnsubscribe = async (accountId: string) => {
    const infoRes = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/unsubscribe`);
    const info = await infoRes.json();
    if (!infoRes.ok) return;
    await fetch(`/api/accounts/${encodeURIComponent(accountId)}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'unsubscribe',
        inventoryId: info.inventoryId,
        listUnsubscribe: info.listUnsubscribe,
        listUnsubscribePost: info.listUnsubscribePost,
      }),
    });
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Accounts</CardTitle>
          <CardDescription>
            Accounts are services we infer from your email signals (newsletters, receipts, security emails).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <Button key={c} variant={c === category ? 'default' : 'secondary'} size="sm" onClick={() => setCategory(c)} className="capitalize">
              {c}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Identity:</span>
            <Button variant={identity === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setIdentity('all')}>
              All
            </Button>
            {identities.map((i: any) => (
              <Button key={i.id} variant={identity === i.id ? 'default' : 'ghost'} size="sm" onClick={() => setIdentity(i.id)}>
                {i.email}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a: any) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="font-headline flex items-center justify-between">
                <Link href={`/accounts/${encodeURIComponent(a.id)}`} className="hover:underline">
                  {a.serviceName}
                </Link>
                <Badge variant={a.confidenceScore >= 0.7 ? 'default' : a.confidenceScore >= 0.4 ? 'secondary' : 'outline'}>
                  {a.confidenceScore >= 0.7 ? 'High' : a.confidenceScore >= 0.4 ? 'Medium' : 'Low'}
                </Badge>
              </CardTitle>
              <CardDescription className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span className="break-all text-[13px] text-foreground">
                  {a.serviceDomain}
                </span>
                <span className="flex justify-between gap-2">
                  <span>
                    {identityLabel(a.emailIdentityId) && (
                      <>Inbox: {identityLabel(a.emailIdentityId)}</>
                    )}
                  </span>
                  <span>
                    Last seen {new Date(a.lastSeenAt).toLocaleDateString()}
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Badge className="capitalize" variant="secondary">{a.category}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/accounts/${encodeURIComponent(a.id)}`}>Open</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onUnsubscribe(a.id)}>Unsubscribe</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await fetch('/api/tasks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ accountId: a.id, title: `Review ${a.serviceName}`, type: 'review' }),
                    });
                  }}
                >
                  Create task
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!accounts.length && (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="No accounts yet"
            description="We have not inferred any services yet. Run a sync from Overview to populate this list."
            actionLabel="Go to Overview and Sync"
            onAction={() => router.push('/overview')}
          />
        )}
      </div>
    </div>
  );
}
