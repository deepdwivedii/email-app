"use client";

import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const categories = ['all','bank','social','ecommerce','saas','subscription','other'] as const;

export default function AccountsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [category, setCategory] = React.useState<(typeof categories)[number]>('all');
  const [identity, setIdentity] = React.useState<string>('all');
  const { data: identitiesData } = useSWR(user ? '/api/mailboxes' : null, fetcher);
  const identities = identitiesData?.identities ?? [];
  const queryA = category !== 'all' ? `category=${category}` : '';
  const queryB = identity !== 'all' ? `emailIdentityId=${encodeURIComponent(identity)}` : '';
  const query = [queryA, queryB].filter(Boolean).join('&');
  const accountsKey = user ? `/api/accounts${query ? `?${query}` : ''}` : null;
  const { data } = useSWR(accountsKey, fetcher);
  const accounts = data?.accounts ?? [];

  if (!loading && !user) {
    router.push('/login');
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
          <CardDescription>Services inferred from your inbox. Use filters to focus.</CardDescription>
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
              <CardDescription className="flex items-center justify-between">
                <span className="break-all">{a.serviceDomain}</span>
                <span className="text-xs">Last seen {new Date(a.lastSeenAt).toLocaleDateString()}</span>
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
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">No accounts yet</CardTitle>
              <CardDescription>Run sync to discover accounts from your inbox.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
