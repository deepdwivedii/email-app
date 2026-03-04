"use client";

import * as React from "react";
import useSWR from "swr";
import { useRequireAuth } from "@/hooks/use-auth";
import DomainTable from "@/components/domain-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { DomainInfo as BaseDomainInfo } from "@/types";

type DomainInfo = BaseDomainInfo & {
  mailboxId?: string;
  status?: "active" | "moved" | "ignored";
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SubscriptionsPage() {
  const { user, loading } = useRequireAuth();
  const { data } = useSWR(user ? "/api/inventory" : null, fetcher);
  const { data: mbData } = useSWR(user ? "/api/mailboxes" : null, fetcher);

  const domains: DomainInfo[] = data?.domains ?? [];
  const mailboxes = React.useMemo(() => mbData?.mailboxes ?? [], [mbData]);
  const aliasMap = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    mailboxes.forEach((m: { id: string; displayName?: string; email: string }) => {
      map[m.id] = m.displayName || m.email;
    });
    return map;
  }, [mailboxes]);

  const [query, setQuery] = React.useState("");
  const [mailboxFilter, setMailboxFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "subscribed" | "unsubscribed" | "ignored">(
    "all"
  );
  const [minVolume, setMinVolume] = React.useState<number>(0);

  if (loading || !user) {
    return null;
  }

  const filtered = domains
    .filter((d) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return d.domain.toLowerCase().includes(q);
    })
    .filter((d) => {
      if (mailboxFilter === "all") return true;
      return d.mailboxId === mailboxFilter;
    })
    .filter((d) => {
      if (statusFilter === "all") return true;
      const status = d.status || (d.isUnsubscribed ? "moved" : "active");
      if (statusFilter === "subscribed") return status === "active";
      if (statusFilter === "ignored") return status === "ignored";
      return status !== "active";
    })
    .filter((d) => d.count >= minVolume)
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Subscriptions</CardTitle>
          <CardDescription>
            Domain-based view of senders across your inbox. Safely unsubscribe or mark trusted senders.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr,1fr,1fr,2fr] md:items-end">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="subscriptions-search">
              Search
            </label>
            <Input
              id="subscriptions-search"
              placeholder="Filter by domain"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Mailbox</span>
            <Select value={mailboxFilter} onValueChange={setMailboxFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All mailboxes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All mailboxes</SelectItem>
                {mailboxes.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Volume</span>
              <span className="text-[11px] text-muted-foreground">
                ≥ {minVolume} emails
              </span>
            </div>
            <Slider
              value={[minVolume]}
              min={0}
              max={50}
              step={5}
              onValueChange={(vals) => setMinVolume(vals[0] ?? 0)}
              aria-label="Minimum number of emails for a sender"
            />
          </div>
        </CardContent>
      </Card>

      <DomainTable domains={filtered} aliasMap={aliasMap} />
    </div>
  );
}
