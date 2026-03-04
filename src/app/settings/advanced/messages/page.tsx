"use client";

import useSWR from "swr";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";

type RawMessage = {
  id: string;
  mailboxId: string;
  mailboxEmail: string | null;
  mailboxProvider: string | null;
  providerMsgId: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: number;
  listUnsubscribe: string | null;
  listUnsubscribePost: string | null;
  rootDomain: string | null;
  category: string | null;
  aiStatus: string | null;
  aiProcessedAt: number | null;
  aiError: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdvancedMessagesPage() {
  const { user, loading } = useRequireAuth();
  const [page, setPage] = useState(1);
  const { data } = useSWR(user ? `/api/messages?page=${page}` : null, fetcher);
  const [query, setQuery] = useState("");

  if (loading || !user) {
    return null;
  }

  const messages: RawMessage[] = data?.messages ?? [];
  const total: number = data?.total ?? messages.length;
  const pageSize: number = data?.pageSize ?? 50;
  const filtered = messages.filter((m) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      m.subject.toLowerCase().includes(q) ||
      m.from.toLowerCase().includes(q) ||
      (m.mailboxEmail ?? "").toLowerCase().includes(q) ||
      (m.rootDomain ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline text-xl">Raw messages</CardTitle>
            <CardDescription>
              Header-only view of messages fetched from your connected inboxes. This is an advanced
              debugging view.
            </CardDescription>
          </div>
          <Input
            placeholder="Filter by subject, from, mailbox, or domain"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>No messages found.</p>
              <p>
                To populate this view, go to{" "}
                <Link href="/overview" className="underline">
                  Overview
                </Link>{" "}
                and run a sync.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/overview">Go to Overview and Sync</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mailbox</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>AI</TableHead>
                      <TableHead>Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="max-w-[180px] truncate text-xs sm:text-sm">
                          <div className="flex flex-col">
                            <span className="truncate">
                              {m.mailboxEmail ?? m.mailboxId}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {m.mailboxProvider ?? "unknown"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs sm:text-sm">
                          {m.from}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs sm:text-sm">
                          {m.subject || "(no subject)"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs sm:text-sm">
                          {m.rootDomain ?? "—"}
                        </TableCell>
                        <TableCell>
                          {m.category ? (
                            <Badge
                              variant="secondary"
                              className="capitalize text-[10px] sm:text-xs"
                            >
                              {m.category}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.aiStatus ? (
                            <Badge
                              variant={
                                m.aiStatus === "done"
                                  ? "default"
                                  : m.aiStatus === "error"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-[10px] sm:text-xs uppercase tracking-wide"
                            >
                              {m.aiStatus}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not queued</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                          {new Date(m.receivedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs sm:text-sm">
                <span>
                  {total > 0
                    ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                        (page - 1) * pageSize + messages.length,
                        total
                      )} of ${total}`
                    : "No messages"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={messages.length < pageSize}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
