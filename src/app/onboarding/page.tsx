"use client";

import * as React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GmailIcon, OutlookIcon } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

export default function OnboardingPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { data: mbData, mutate: mutateMailboxes } = useSWR(
    user ? "/api/mailboxes" : null,
    fetcher
  );
  const { data: analyticsData, mutate: mutateAnalytics } = useSWR(
    user ? "/api/analytics" : null,
    fetcher
  );

  const mailboxes = mbData?.mailboxes ?? [];
  const hasMailbox = mailboxes.length > 0;
  const summary = analyticsData?.summary;
  const hasScan = (summary?.totalDomains ?? 0) > 0 || (summary?.totalAccounts ?? 0) > 0;

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
        const res = await fetch("/api/sync/status");
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
  }, [pollingRun]);

  React.useEffect(() => {
    if (!loading && user && hasMailbox && hasScan) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("atlas:onboarded", "true");
      }
      router.replace("/overview");
    }
  }, [loading, user, hasMailbox, hasScan, router]);

  const startBackgroundRun = async () => {
    try {
      const res = await fetch("/api/sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full" }),
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
        description: e?.message || "Please try again.",
      });
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      if (syncMode === "full") {
        startBackgroundRun();
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

  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const checklistComplete = {
    connect: hasMailbox,
    chooseMode: !!syncMode,
    runScan: !!syncStatus || hasScan,
    reviewSubscriptions: (summary?.totalDomains ?? 0) > 0,
    reviewAccounts: (summary?.totalAccounts ?? 0) > 0,
  };

  const currentStep = !checklistComplete.connect
    ? 1
    : !checklistComplete.chooseMode
    ? 2
    : !checklistComplete.runScan
    ? 3
    : 4;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[260px,1fr]">
        <aside aria-label="Onboarding checklist">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-lg">Getting started</CardTitle>
              <CardDescription>Follow these steps to see results in under 2 minutes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StepItem label="Connect an inbox" active={currentStep === 1} done={checklistComplete.connect} />
              <StepItem label="Choose scan type" active={currentStep === 2} done={checklistComplete.chooseMode} />
              <StepItem label="Run scan" active={currentStep === 3} done={checklistComplete.runScan} />
              <StepItem label="Review Subscriptions" active={currentStep === 4} done={checklistComplete.reviewSubscriptions} />
              <StepItem label="Review Accounts" active={false} done={checklistComplete.reviewAccounts} />
            </CardContent>
          </Card>
        </aside>
        <main className="space-y-4">
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-xl">Step 1 — Connect inbox</CardTitle>
                <CardDescription>
                  Link Gmail or Outlook. We request read-only metadata access by default.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground" htmlFor="onboarding-alias">
                    Nickname (optional)
                  </label>
                  <input
                    id="onboarding-alias"
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="e.g. Personal, Work, Side project"
                    onChange={() => {}}
                    onBlur={(e) => {
                      const alias = e.target.value.trim();
                      if (!alias || typeof window === "undefined") return;
                      window.sessionStorage.setItem("atlas:connectAlias", alias);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const alias =
                        typeof window !== "undefined"
                          ? window.sessionStorage.getItem("atlas:connectAlias") || ""
                          : "";
                      const params = new URLSearchParams();
                      if (alias.trim()) params.set("alias", alias.trim());
                      const url = params.toString()
                        ? `/api/oauth/google/start?${params.toString()}`
                        : "/api/oauth/google/start";
                      if (typeof window !== "undefined") window.location.href = url;
                    }}
                  >
                    <GmailIcon className="mr-2 h-5 w-5" />
                    Connect Google
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const alias =
                        typeof window !== "undefined"
                          ? window.sessionStorage.getItem("atlas:connectAlias") || ""
                          : "";
                      const params = new URLSearchParams();
                      if (alias.trim()) params.set("alias", alias.trim());
                      const url = params.toString()
                        ? `/api/oauth/microsoft/start?${params.toString()}`
                        : "/api/oauth/microsoft/start";
                      if (typeof window !== "undefined") window.location.href = url;
                    }}
                  >
                    <OutlookIcon className="mr-2 h-5 w-5" />
                    Connect Microsoft
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-xl">Step 2 — Choose scan type</CardTitle>
                <CardDescription>
                  Start with a Quick scan to get results in seconds, or run a Full import to backfill everything.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSyncMode("quick")}
                  className={`flex flex-col items-start rounded-lg border p-4 text-left text-sm transition-colors ${
                    syncMode === "quick"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <span className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Quick scan
                  </span>
                  <p className="mb-1 font-medium">Recent mail (fast)</p>
                  <p className="text-xs text-muted-foreground">
                    Last 7–30 days of headers. Typically completes in 10–30 seconds.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMode("full")}
                  className={`flex flex-col items-start rounded-lg border p-4 text-left text-sm transition-colors ${
                    syncMode === "full"
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <span className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Full import
                  </span>
                  <p className="mb-1 font-medium">All mail (background)</p>
                  <p className="text-xs text-muted-foreground">
                    Scans your full history in chunks and can run in the background.
                  </p>
                </button>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-xl">Step 3 — Run scan</CardTitle>
                <CardDescription>
                  We will import headers from your active inbox and build subscriptions and accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:max-w-sm">
                  <Button onClick={runSync} disabled={syncing || !hasMailbox}>
                    {syncing
                      ? "Scanning…"
                      : syncMode === "quick"
                      ? "Start Quick scan"
                      : "Start Full import"}
                  </Button>
                  {syncMode === "full" && (syncing || syncProgress > 0) && (
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <Progress value={syncProgress || 10} />
                      <div className="flex justify-between gap-2">
                        <span>Importing all mail…</span>
                        <span className="hidden sm:inline">
                          You can keep using Atlas while this runs.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {syncStatus && (
                  <div className="space-y-1 text-sm">
                    <p>
                      Mode:{" "}
                      <span className="font-semibold">
                        {syncStatus.mode === "quick" ? "Quick" : "Full"}
                      </span>
                    </p>
                    <p>
                      Messages imported:{" "}
                      <span className="font-semibold">
                        {syncStatus.gmail + syncStatus.outlook}
                      </span>
                    </p>
                    <p>
                      Last run:{" "}
                      <span className="font-semibold">
                        {new Date(syncStatus.lastSynced).toLocaleString()}
                      </span>
                    </p>
                  </div>
                )}
                {activeRun && (
                  <div className="space-y-1 text-xs text-muted-foreground">
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
                {syncStatus && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/subscriptions">Review Subscriptions</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/accounts">Review Accounts</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep >= 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-xl">You are ready to go</CardTitle>
                <CardDescription>
                  Your first scan is complete. You can always return here from the Overview page if you
                  connect new inboxes.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <Button asChild size="sm">
                  <Link href="/overview">Go to Overview</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                >
                  <Link href="/subscriptions">Open Subscriptions</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                >
                  <Link href="/accounts">Open Accounts</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function StepItem({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          done
            ? "bg-emerald-500 text-emerald-50"
            : active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
        aria-hidden="true"
      >
        {done ? "✓" : ""}
      </span>
      <span
        className={`text-sm ${
          active ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
