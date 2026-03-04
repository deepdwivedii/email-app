"use client";

import * as React from "react";
import useSWR from "swr";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GmailIcon, OutlookIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { MetricCard } from "@/components/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ConnectMailbox() {
  const [alias, setAlias] = React.useState("");

  const startConnect = (provider: "google" | "microsoft") => {
    const params = new URLSearchParams();
    const trimmed = alias.trim();
    if (trimmed) params.set("alias", trimmed);
    const base =
      provider === "google"
        ? "/api/oauth/google/start"
        : "/api/oauth/microsoft/start";
    const url = params.toString() ? `${base}?${params.toString()}` : base;
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Connect an inbox</CardTitle>
        <CardDescription>
          We read headers only by default—never message content. Link Gmail or Outlook to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="connect-alias">
            Nickname (optional)
          </label>
          <input
            id="connect-alias"
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="e.g. Personal, Work, Side project"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => startConnect("google")}
          >
            <GmailIcon className="mr-2 h-5 w-5" />
            Connect Google
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => startConnect("microsoft")}
          >
            <OutlookIcon className="mr-2 h-5 w-5" />
            Connect Microsoft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type SyncStatus = {
  mode: "quick" | "full";
  gmail: number;
  outlook: number;
  errors: number;
  lastSynced: number;
};

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

export default function OverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { data: mbData, mutate: mutateMailboxes } = useSWR(user ? "/api/mailboxes" : null, fetcher);
  const { data: analyticsData, mutate: mutateAnalytics } = useSWR(
    user ? "/api/analytics" : null,
    fetcher
  );

  const mailboxes = React.useMemo(() => mbData?.mailboxes ?? [], [mbData]);
  const activeMailboxId = mbData?.activeMailboxId ?? null;
  const summary = analyticsData?.summary;
  const aliasLegend = React.useMemo<string[]>(() => {
    if (!mailboxes.length) return [];
    return mailboxes.map((m: { displayName?: string; email: string }) => {
      const label = m.displayName || m.email;
      return `${label}`;
    });
  }, [mailboxes]);

  const [syncMode, setSyncMode] = React.useState<"quick" | "full">(() => {
    if (typeof window === "undefined") return "quick";
    const stored = window.localStorage.getItem("atlas:syncMode");
    return stored === "full" ? "full" : "quick";
  });

  const [syncing, setSyncing] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("atlas:syncStatus");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SyncStatus;
    } catch {
      return null;
    }
  });
  const [syncProgress, setSyncProgress] = React.useState(0);
  const [activeRun, setActiveRun] = React.useState<ActiveSyncRun | null>(null);
  const [pollingRun, setPollingRun] = React.useState(false);
  const [syncingMailboxId, setSyncingMailboxId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atlas:syncMode", syncMode);
    }
  }, [syncMode]);

  React.useEffect(() => {
    if (typeof window !== "undefined" && syncStatus) {
      window.localStorage.setItem("atlas:syncStatus", JSON.stringify(syncStatus));
    }
  }, [syncStatus]);

  React.useEffect(() => {
    if (!syncing || syncMode !== "full") {
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
  }, [syncing, syncMode]);

  React.useEffect(() => {
    if (!pollingRun) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const params = syncingMailboxId ? `?mailboxId=${encodeURIComponent(syncingMailboxId)}` : "";
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
            setSyncingMailboxId(null);
            mutateMailboxes();
            mutateAnalytics();
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
  }, [pollingRun, mutateMailboxes, mutateAnalytics, syncingMailboxId]);

  const [isMerged, setIsMerged] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMerged(window.localStorage.getItem("atlas:mb_mode") === "merged");
  }, [mailboxes.length]);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?from=/overview");
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (!mailboxes.length) return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const errorParam = params.get("error");
    const errorCode = params.get("code");
    if (connected) {
      toast({
        title: "Inbox connected",
        description: `Your ${connected} inbox is linked. Next: run your first scan.`,
      });
      mutateMailboxes();
      mutateAnalytics();
      params.delete("connected");
      const base = window.location.pathname;
      const next = params.toString() ? `${base}?${params.toString()}` : base;
      window.history.replaceState({}, "", next);
    } else if (errorParam) {
      toast({
        variant: "destructive",
        title: "Connection did not complete",
        description: `We could not finish linking your account.${errorCode ? ` Code: ${errorCode}` : ""}`,
      });
    }
  }, [mailboxes.length, toast, mutateMailboxes, mutateAnalytics]);

  const setActive = async (id: string) => {
    await fetch("/api/mailboxes/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId: id }),
    });
  };

  const reconnectUrl = (provider: string) => {
    return provider === "gmail" ? "/api/oauth/google/start" : "/api/oauth/microsoft/start";
  };

  const startBackgroundRun = async (mailboxId?: string) => {
    try {
      const res = await fetch("/api/sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mailboxId ? { mode: "full", mailboxId } : { mode: "full" }
        ),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.run) {
        toast({
          variant: "destructive",
          title: "Background import not started",
          description: j?.error || "Please try again.",
        });
        return;
      }
      const run = j.run as ActiveSyncRun;
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
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Background import error",
        description: e?.message || String(e),
      });
    }
  };

  const runSync = async (mailboxId?: string) => {
    setSyncing(true);
    try {
      if (mailboxId) {
        await setActive(mailboxId);
        setSyncingMailboxId(mailboxId);
      }
      if (syncMode === "full") {
        startBackgroundRun(mailboxId);
      }
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: syncMode }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        await Promise.all([mutateMailboxes(), mutateAnalytics()]);
        if (j) {
          const gmail = Number(j.gmail || 0);
          const outlook = Number(j.outlook || 0);
          const errors = Array.isArray(j.errors) ? j.errors.length : 0;
          const lastSynced = Number(j.lastSynced || Date.now());
          setSyncStatus({
            mode: syncMode,
            gmail,
            outlook,
            errors,
            lastSynced,
          });
          toast({
            title: "Scan complete",
            description: `Imported ${gmail + outlook} messages` + (errors ? `, ${errors} errors.` : "."),
          });
        } else {
          toast({ title: "Scan complete" });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Scan failed",
          description: j?.error || "Please try again.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Sync error",
        description: e?.message || String(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  if (authLoading || (!analyticsData && user && !mbData)) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasMailboxes = mailboxes.length > 0;
  const syncLabel =
    syncMode === "quick" ? "Scan recent mail (fast)" : "Import all mail (runs in background)";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <section aria-label="Sync status">
        <Card className="border-border/80 bg-background/90">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Status
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  Inboxes connected:{" "}
                  <span className="font-semibold">{summary?.mailboxCount ?? mailboxes.length}</span>
                </span>
                <span className="hidden text-muted-foreground sm:inline">•</span>
                <span>
                  Last sync:{" "}
                  <span className="font-semibold">
                    {summary?.lastSyncAt
                      ? new Date(summary.lastSyncAt).toLocaleString()
                      : "Not yet run"}
                  </span>
                </span>
                {isMerged && (
                  <>
                    <span className="hidden text-muted-foreground sm:inline">•</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Merged view
                    </span>
                  </>
                )}
              </div>
              {aliasLegend.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {aliasLegend.map((label: string, idx: number) => (
                    <span
                      key={idx}
                      className="rounded-full bg-muted px-2 py-0.5"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs">
                <span className="text-muted-foreground">Scan mode</span>
                <Button
                  type="button"
                  size="sm"
                  variant={syncMode === "quick" ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setSyncMode("quick")}
                >
                  Quick
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={syncMode === "full" ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setSyncMode("full")}
                >
                  Full
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:items-stretch sm:min-w-[220px]">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => runSync()}
                  disabled={syncing || !hasMailboxes}
                >
                  {syncing ? "Syncing…" : syncLabel}
                </Button>
                {syncMode === "full" && (syncing || syncProgress > 0) && (
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <Progress value={syncProgress || 10} />
                    <div className="flex justify-between gap-2">
                      <span>Importing all mail…</span>
                      <span className="hidden sm:inline">You can keep using Atlas while this runs.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          {syncMode === "full" && (
            <CardFooter className="px-4 pb-4 text-xs text-muted-foreground">
              Full import scans your entire mailbox and can run in the background.
            </CardFooter>
          )}
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Insights summary">
        <MetricCard
          title="Emails scanned"
          value={summary?.totalMessages ?? 0}
        />
        <MetricCard
          title="Subscriptions detected"
          value={summary?.totalDomains ?? 0}
        />
        <MetricCard
          title="Accounts inferred"
          value={summary?.totalAccounts ?? 0}
        />
        <MetricCard
          title="Unsubscribed senders"
          value={summary?.unsubscribedDomains ?? 0}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Next actions and activity">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Recommended next actions</CardTitle>
            <CardDescription>
              Start with subscriptions, then review important accounts and tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Clean noisy subscriptions</p>
                <p className="text-xs text-muted-foreground">
                  View your domain inventory and safely unsubscribe.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/subscriptions">Open Subscriptions</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Review important accounts</p>
                <p className="text-xs text-muted-foreground">
                  Check high-confidence services inferred from your email.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/accounts">Open Accounts</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Act on follow-up tasks</p>
                <p className="text-xs text-muted-foreground">
                  Close accounts, unsubscribe, or enable 2FA with clear tasks.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/tasks">Open Tasks</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Sync progress</CardTitle>
            <CardDescription>
              Recent scan summary across Gmail and Outlook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncStatus ? (
              <div className="space-y-2 text-sm">
                <p>
                  Mode:{" "}
                  <span className="font-semibold">
                    {syncStatus.mode === "quick" ? "Quick" : "Full"}
                  </span>
                </p>
                <p>
                  Messages imported this run:{" "}
                  <span className="font-semibold">
                    {syncStatus.gmail + syncStatus.outlook}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    (Gmail {syncStatus.gmail}, Outlook {syncStatus.outlook})
                  </span>
                </p>
                <p>
                  Total emails scanned:{" "}
                  <span className="font-semibold">
                    {summary?.totalMessages ?? 0}
                  </span>
                </p>
                <p>
                  Last run:{" "}
                  <span className="font-semibold">
                    {new Date(syncStatus.lastSynced).toLocaleString()}
                  </span>
                </p>
                <p>
                  Errors:{" "}
                  <span className="font-semibold">
                    {syncStatus.errors}
                  </span>
                </p>
                {activeRun && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Background full import
                    </p>
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
                      Messages processed this run:{" "}
                      <span className="font-semibold">
                        {activeRun.importedCount}
                      </span>
                    </p>
                    {activeRun.status === "error" && activeRun.error && (
                      <p className="text-xs text-destructive">
                        Error: {activeRun.error}
                      </p>
                    )}
                  </div>
                )}
                {syncStatus.mode === "full" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => runSync()}
                      disabled={syncing}
                    >
                      Continue full import
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No scan has been run yet. Start with a Quick scan to see results in under a minute.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Connected inboxes">
        {hasMailboxes ? (
          <TooltipProvider>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mailboxes.map((m: any) => (
                <Card key={m.id}>
                  <CardHeader>
                    <CardTitle className="font-headline text-base flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        {m.provider === "gmail" ? (
                          <GmailIcon className="h-5 w-5" />
                        ) : (
                          <OutlookIcon className="h-5 w-5" />
                        )}
                        <span className="break-all">{m.email}</span>
                        {m.id === activeMailboxId && (
                          <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
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
                    <CardDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Last sync{" "}
                        {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : "—"}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {m.id !== activeMailboxId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActive(m.id)}
                          >
                            Set active
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runSync(m.id)}
                          disabled={syncingMailboxId === m.id || syncing}
                        >
                          {syncingMailboxId === m.id ? "Syncing…" : "Sync this inbox"}
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={reconnectUrl(m.provider)}>
                            <RefreshCw className="mr-1 h-4 w-4" />
                            Reconnect
                          </a>
                        </Button>
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TooltipProvider>
        ) : (
          <ConnectMailbox />
        )}
      </section>

      {hasMailboxes && (
        <section aria-label="Connect another inbox">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-lg">
                Connect another inbox
              </CardTitle>
              <CardDescription>
                Add an additional Gmail or Outlook account to include its subscriptions and accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectMailbox />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
