"use client";

import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRequireAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AccountDetailPage({ params }: any) {
  const { id } = params as { id: string };
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const { data } = useSWR(user ? `/api/accounts/${encodeURIComponent(id)}` : null, fetcher);
  const account = data?.account;
  const evidence = data?.evidence ?? [];
  const [taskTitle, setTaskTitle] = React.useState('');
  const { toast } = useToast();

  if (loading || !user) {
    return null;
  }

  if (!account) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardHeader>
          <CardTitle className="font-headline">Account Not Found</CardTitle>
          <CardDescription>We couldn&apos;t find that account.</CardDescription>
        </CardHeader>
      </Card>
    </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">{account.serviceName}</CardTitle>
          <CardDescription>
            Domain {account.serviceDomain} • Confidence {Math.round((account.confidenceScore || 0) * 100)}% • Last seen {new Date(account.lastSeenAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Why this account</CardTitle>
          <CardDescription>{account.explanation}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Evidence</CardTitle>
          <CardDescription>Signals used to infer this account.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <div className="space-y-3">
            {evidence.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{e.evidenceType}</span>
                  <span className="truncate text-sm">{e.excerpt || ''}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span>{e.weight}</span>
                  <span>{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {!evidence.length && (
              <div className="text-sm text-muted-foreground">No evidence recorded yet.</div>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-headline">Actions</CardTitle>
          <CardDescription>Quick actions and tasks for this account.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 flex items-center gap-3">
          <Button
            onClick={async () => {
              const res = await fetch(`/api/accounts/${encodeURIComponent(id)}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionType: 'open_settings_link', target: `https://${account.serviceDomain}` }),
              });
              if (res.ok) router.push(`https://${account.serviceDomain}`);
            }}
            variant="secondary"
          >
            Open service
          </Button>
          <Button
            onClick={async () => {
              try {
                const infoRes = await fetch(`/api/accounts/${encodeURIComponent(id)}/unsubscribe`);
                const info = await infoRes.json();
                if (!infoRes.ok) {
                  toast({ variant: 'destructive', title: 'Unsubscribe info unavailable', description: info?.error || 'Try again later.' });
                  return;
                }
                const actRes = await fetch(`/api/accounts/${encodeURIComponent(id)}/actions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    actionType: 'unsubscribe',
                    inventoryId: info.inventoryId,
                    listUnsubscribe: info.listUnsubscribe,
                    listUnsubscribePost: info.listUnsubscribePost,
                  }),
                });
                const j = await actRes.json().catch(() => ({}));
                if (actRes.ok) {
                  toast({ title: 'Unsubscribe requested', description: j?.status === 'success' ? 'Request sent successfully.' : 'Request queued.' });
                } else {
                  toast({ variant: 'destructive', title: 'Unsubscribe failed', description: j?.error || 'The sender did not accept the request.' });
                }
              } catch (e: any) {
                toast({ variant: 'destructive', title: 'Network error', description: e?.message || String(e) });
              }
            }}
          >
            Unsubscribe
          </Button>
          <Button
            onClick={async () => {
              await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: id, title: taskTitle || `Review ${account.serviceName}`, type: 'review' }),
              });
              setTaskTitle('');
            }}
          >
            Create task
          </Button>
          <Input
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </Card>

    </div>
  );
}
