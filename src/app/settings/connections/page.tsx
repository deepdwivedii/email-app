"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GmailIcon, OutlookIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type ActiveSyncRun = {
  id: string;
  mode: "quick" | "full" | "delta";
  status: "queued" | "running" | "paused" | "done" | "error" | "needs_reauth";
  stage: "listing" | "fetching" | "upserting" | "aggregating";
  importedCount: number;
  startedAt: number;
  finishedAt?: number;
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ConnectionsSettingsPage() {
  const { user, loading } = useRequireAuth();
  const { data, mutate } = useSWR(user ? "/api/mailboxes" : null, fetcher);
  const mailboxes = data?.mailboxes ?? [];
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [syncProgress, setSyncProgress] = React.useState(0);
  const [activeRun, setActiveRun] = React.useState<ActiveSyncRun | null>(null);
  const [pollingRun, setPollingRun] = React.useState(false);

  React.useEffect(() => {
    if (!syncingId) {
      setSyncProgress(0);
      return;
    }
    let value = 10;
    setSyncProgress(value);
    const id = window.setInterval(() => {
      value = value >= 95 ? 30 : value + 5;
      setSyncProgress(value);
    }, 500);
    return () => {
      window.clearInterval(id);
    };
  }, [syncingId]);

  React.useEffect(() => {
    if (!pollingRun) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const params = syncingId ? `?mailboxId=${encodeURIComponent(syncingId)}` : "";
        const res = await fetch(`/api/sync/status${params}`);
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.run) {
          if (!cancelled) {
            setActiveRun(null);
            setPollingRun(false);
          }
          return;
        }
        const run = j.run as ActiveSyncRun;
        if (!cancelled) {
          setActiveRun({
            id: run.id,
            mode: run.mode,
            status: run.status,
            stage: run.stage,
            importedCount: Number(run.importedCount || 0),
            startedAt: Number(run.startedAt || Date.now()),
            finishedAt: run.finishedAt ? Number(run.finishedAt) : undefined,
            error: run.error,
          });
          if (
            run.status === "done" ||
            run.status === "error" ||
            run.status === "paused" ||
            run.status === "needs_reauth"
          ) {
            setPollingRun(false);
            setSyncingId(null);
            mutate();
          }
        }
      } catch {
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollingRun, mutate, syncingId]);

  if (loading || !user) {
    return null;
  }

  const setActive = async (id: string, mode?: "merged") => {
    await fetch("/api/mailboxes/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId: id, mode }),
    });
    if (typeof window !== "undefined") {
      if (mode === "merged") {
        window.localStorage.setItem("atlas:mb_mode", "merged");
      } else {
        window.localStorage.removeItem("atlas:mb_mode");
      }
    }
  };

  const disconnect = async (id: string) => {
    await fetch(`/api/mailboxes/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
    await mutate();
  };

  const syncNow = async (id: string) => {
    setSyncingId(id);
    await setActive(id);
    try {
      const startRes = await fetch("/api/sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quick", mailboxId: id }),
      });
      const startJson = await startRes.json().catch(() => null);
      if (startRes.ok && startJson?.run) {
        const run = startJson.run as ActiveSyncRun;
        setActiveRun({
          id: run.id,
          mode: run.mode,
          status: run.status,
          stage: run.stage,
          importedCount: Number(run.importedCount || 0),
          startedAt: Number(run.startedAt || Date.now()),
          finishedAt: run.finishedAt ? Number(run.finishedAt) : undefined,
          error: run.error,
        });
        setPollingRun(true);
      }
    } catch {
    }
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "quick" }),
    });
    if (res.ok) {
      await mutate();
    }
    setSyncingId(null);
  };

  const reconnectUrl = (provider: string) => {
    return provider === "gmail" ? "/api/oauth/google/start" : "/api/oauth/microsoft/start";
  };

  const getFrequency = (id: string): string => {
    if (typeof window === "undefined") return "manual";
    return localStorage.getItem(`sync:mb:${id}`) || "manual";
  };

  const setFrequency = (id: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`sync:mb:${id}`, value);
  };

  const getAlias = (mb: any): string => {
    return (mb.displayName as string | undefined) || "";
  };

  const setAlias = async (mb: any, value: string) => {
    const trimmed = value.trim();
    try {
      await fetch(`/api/mailboxes/${encodeURIComponent(mb.id)}/alias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      await mutate();
    } catch {
      // Keep current UI; server-side alias may not be updated if this fails.
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Connections</CardTitle>
          <CardDescription>
            Manage connected inboxes, set the active mailbox, and control sync behavior.
          </CardDescription>
        </CardHeader>
      </Card>

      <TooltipProvider>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mailboxes.map((m: any) => (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="font-headline flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {m.provider === "gmail" ? (
                      <GmailIcon className="h-5 w-5" />
                    ) : (
                      <OutlookIcon className="h-5 w-5" />
                    )}
                    <div className="flex flex-col">
                      <span className="break-all">
                        {getAlias(m) || m.email}
                      </span>
                      {getAlias(m) && (
                        <span className="text-[10px] text-muted-foreground">
                          {m.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {m.provider}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {m.health === "active" ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {m.health === "active"
                          ? "Connection healthy"
                          : m.statusText || "Connection needs attention"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Connected{" "}
                    {m.connectedAt ? new Date(m.connectedAt).toLocaleString() : "—"}
                  </span>
                  <span className="text-xs">
                    Last sync{" "}
                    {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : "—"}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span>Nickname</span>
                    <input
                      className="w-full rounded border px-2 py-1 text-xs"
                      defaultValue={getAlias(m)}
                      placeholder="e.g. Personal, Work, Side project"
                      onBlur={(e) => setAlias(m, e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setActive(m.id)}>
                      Set active
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => disconnect(m.id)}>
                      Disconnect
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={reconnectUrl(m.provider)}>
                        <RefreshCw className="mr-1 h-4 w-4" />
                        Reconnect
                      </a>
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActive(m.id, "merged")}
                  >
                    Make primary (merged)
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Button size="sm" onClick={() => syncNow(m.id)} disabled={syncingId === m.id}>
                      {syncingId === m.id ? "Syncing…" : "Sync now"}
                    </Button>
                    {syncingId === m.id && (
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <Progress value={syncProgress || 10} />
                        <div className="flex justify-between gap-2">
                          <span>Sync in progress…</span>
                        </div>
                      </div>
                    )}
                    {activeRun && (
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <p>
                          Status:{" "}
                          <span className="font-semibold capitalize">
                            {activeRun.status}
                          </span>{" "}
                          • Stage:{" "}
                          <span className="font-semibold capitalize">
                            {activeRun.stage}
                          </span>
                        </p>
                        <p>
                          Messages processed:{" "}
                          <span className="font-semibold">
                            {activeRun.importedCount}
                          </span>
                        </p>
                        {activeRun.status === "error" && activeRun.error && (
                          <p className="text-xs text-destructive">
                            Error: {activeRun.error}
                          </p>
                        )}
                        {activeRun.status === "needs_reauth" && (
                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-destructive font-medium">
                              Authentication failed. Please reconnect your inbox.
                            </p>
                            <Button variant="destructive" size="sm" asChild className="h-7 text-xs w-fit">
                              <a href={reconnectUrl(m.provider)}>
                                Reconnect Now
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Frequency (UI-only, coming soon)
                    </span>
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
                <CardTitle className="font-headline">No inboxes connected</CardTitle>
                <CardDescription>
                  Go to Overview and run Connect inbox to start syncing.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </TooltipProvider>

      <Card className="mb-2">
        <CardHeader>
          <CardTitle className="font-headline">Merged view</CardTitle>
          <CardDescription>
            Switch to a merged view across identities. This affects how counts are shown.
          </CardDescription>
        </CardHeader>
      </Card>
      <Button
        onClick={() => setActive(mailboxes[0]?.id || "", "merged")}
        disabled={!mailboxes.length}
      >
        Enable merged view
      </Button>
    </div>
  );
}
