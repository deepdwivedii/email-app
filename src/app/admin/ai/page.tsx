"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AiQueueRow = {
  id: string;
  mailbox_id: string;
  message_id: string;
  status: "queued" | "processing" | "done" | "error";
  priority: number;
  attempts: number;
  next_attempt_at: string | null;
  locked_until: string | null;
  created_at: string;
};

type ActionItemRow = {
  id: string;
  mailbox_id: string;
  message_id: string;
  type: string;
  title: string;
  surface_priority: number | null;
  due_at: string | null;
  amount: number | null;
  currency: string | null;
  confidence: number;
  created_at: string;
};

type AiDebugResponse = {
  queue: AiQueueRow[];
  actions: ActionItemRow[];
};

const fetcher = async ([url, token]: [string, string]): Promise<AiDebugResponse> => {
  const res = await fetch(url, {
    headers: {
      "x-admin-token": token,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to load AI debug data: ${res.status}`);
  }
  return res.json();
};

export default function AdminAiPage() {
  const [token, setToken] = React.useState("");
  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("atlas:adminToken");
    if (stored) {
      setToken(stored);
      setInput(stored);
    }
  }, []);

  const { data, error, isLoading, mutate } = useSWR(
    token ? ["/api/admin/ai-debug", token] : null,
    fetcher
  );

  const handleSaveToken = () => {
    const trimmed = input.trim();
    setToken(trimmed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atlas:adminToken", trimmed);
    }
  };

  const handleEnqueue = async () => {
    if (!token) return;
    await fetch("/api/jobs/ai-enqueue", {
      method: "POST",
      headers: {
        "x-internal-secret": token,
      },
    });
    await mutate();
  };

  const handleTick = async () => {
    if (!token) return;
    await fetch("/api/jobs/ai-tick", {
      method: "POST",
      headers: {
        "x-internal-secret": token,
      },
    });
    await mutate();
  };

  const queue = data?.queue ?? [];
  const actions = data?.actions ?? [];

  const queuedCount = queue.filter((q) => q.status === "queued").length;
  const processingCount = queue.filter((q) => q.status === "processing").length;
  const errorCount = queue.filter((q) => q.status === "error").length;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">Admin token</CardTitle>
          <CardDescription>
            Provide the admin token to view AI queue metrics and trigger AI jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="password"
            className="flex-1 rounded border px-3 py-2 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste ADMIN_APP_TOKEN"
          />
          <Button type="button" onClick={handleSaveToken}>
            Set token
          </Button>
        </CardContent>
      </Card>

      {token && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-headline text-lg">AI queue status</CardTitle>
                  <CardDescription>
                    Current ai_queue rows and their message ai_status summaries.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleEnqueue}>
                    Enqueue recent
                  </Button>
                  <Button type="button" size="sm" onClick={handleTick}>
                    Run ai-tick
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && <p className="text-sm text-muted-foreground">Loading AI queue…</p>}
              {error && (
                <p className="text-sm text-destructive">
                  {(error as Error).message}
                </p>
              )}
              {!isLoading && !error && (
                <div className="mb-4 flex flex-wrap gap-4 text-sm">
                  <span>Queued: {queuedCount}</span>
                  <span>Processing: {processingCount}</span>
                  <span>Errors: {errorCount}</span>
                  <span>Total rows: {queue.length}</span>
                </div>
              )}
              {!isLoading && !error && queue.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b text-[11px] uppercase text-muted-foreground">
                        <th className="px-2 py-1 text-left">Id</th>
                        <th className="px-2 py-1 text-left">Mailbox</th>
                        <th className="px-2 py-1 text-left">Message</th>
                        <th className="px-2 py-1 text-left">Status</th>
                        <th className="px-2 py-1 text-left">Priority</th>
                        <th className="px-2 py-1 text-left">Attempts</th>
                        <th className="px-2 py-1 text-left">Next attempt</th>
                        <th className="px-2 py-1 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((q) => (
                        <tr key={q.id} className="border-b last:border-0">
                          <td className="px-2 py-1 align-top font-mono">
                            <div className="max-w-[140px] truncate">{q.id}</div>
                          </td>
                          <td className="px-2 py-1 align-top font-mono">
                            <div className="max-w-[140px] truncate">{q.mailbox_id}</div>
                          </td>
                          <td className="px-2 py-1 align-top font-mono">
                            <div className="max-w-[140px] truncate">{q.message_id}</div>
                          </td>
                          <td className="px-2 py-1 align-top">{q.status}</td>
                          <td className="px-2 py-1 align-top">{q.priority}</td>
                          <td className="px-2 py-1 align-top">{q.attempts}</td>
                          <td className="px-2 py-1 align-top whitespace-nowrap">
                            {q.next_attempt_at ? new Date(q.next_attempt_at).toLocaleString() : "–"}
                          </td>
                          <td className="px-2 py-1 align-top whitespace-nowrap">
                            {new Date(q.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!isLoading && !error && queue.length === 0 && (
                <p className="text-sm text-muted-foreground">No AI queue rows found.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-lg">Recent action items</CardTitle>
              <CardDescription>
                Latest AI-derived action_items for quick inspection of titles, types and confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isLoading && !error && actions.length === 0 && (
                <p className="text-sm text-muted-foreground">No action items found.</p>
              )}
              {!isLoading && !error && actions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b text-[11px] uppercase text-muted-foreground">
                        <th className="px-2 py-1 text-left">Id</th>
                        <th className="px-2 py-1 text-left">Mailbox</th>
                        <th className="px-2 py-1 text-left">Message</th>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-left">Title</th>
                        <th className="px-2 py-1 text-left">Confidence</th>
                        <th className="px-2 py-1 text-left">Due</th>
                        <th className="px-2 py-1 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="px-2 py-1 align-top font-mono">
                            <div className="max-w-[140px] truncate">{a.id}</div>
                          </td>
                          <td className="px-2 py-1 align-top font-mono">
                            <div className="max-w-[140px] truncate">{a.mailbox_id}</div>
                          </td>
                          <td className="px-2 py-1 align-top font-mono">
                            <div className="max-w-[140px] truncate">{a.message_id}</div>
                          </td>
                          <td className="px-2 py-1 align-top">{a.type}</td>
                          <td className="px-2 py-1 align-top">
                            <div className="max-w-[260px] truncate">{a.title}</div>
                          </td>
                          <td className="px-2 py-1 align-top">
                            {(a.confidence * 100).toFixed(0)}%
                          </td>
                          <td className="px-2 py-1 align-top whitespace-nowrap">
                            {a.due_at ? new Date(a.due_at).toLocaleString() : "–"}
                          </td>
                          <td className="px-2 py-1 align-top whitespace-nowrap">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

