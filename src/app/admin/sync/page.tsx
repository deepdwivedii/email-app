"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SyncRunRow = {
  id: string;
  userid: string;
  mailboxid: string;
  mode: string;
  status: string;
  stage: string | null;
  startedat: number;
  finishedat: number | null;
  importedcount: number | null;
  cursorsnapshot: unknown | null;
};

type SyncRunsResponse = {
  runs: SyncRunRow[];
};

const runsFetcher = async ([url, token]: [string, string]): Promise<SyncRunsResponse> => {
  const res = await fetch(url, {
    headers: {
      "x-admin-token": token,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to load sync runs: ${res.status}`);
  }
  return res.json();
};

export default function AdminSyncPage() {
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
    token ? ["/api/admin/sync-runs?limit=50", token] : null,
    runsFetcher
  );

  const handleSaveToken = () => {
    const trimmed = input.trim();
    setToken(trimmed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atlas:adminToken", trimmed);
    }
  };

  const handleSyncTick = async () => {
    if (!token) return;
    await fetch("/api/admin/sync-tick", {
      method: "POST",
      headers: {
        "x-admin-token": token,
      },
    });
    await mutate();
  };

  const runs = data?.runs ?? [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">Admin token</CardTitle>
          <CardDescription>
            Provide the admin token to view sync runs and trigger sync ticks.
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-headline text-lg">Recent sync runs</CardTitle>
                <CardDescription>
                  Latest runs across mailboxes, limited to 50 for metrics safety.
                </CardDescription>
              </div>
              <Button type="button" size="sm" onClick={handleSyncTick}>
                Run sync-tick
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground">Loading runs…</p>}
            {error && (
              <p className="text-sm text-destructive">
                {(error as Error).message}
              </p>
            )}
            {!isLoading && !error && runs.length === 0 && (
              <p className="text-sm text-muted-foreground">No runs found.</p>
            )}
            {!isLoading && !error && runs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-1 text-left">Run</th>
                      <th className="px-2 py-1 text-left">Mailbox</th>
                      <th className="px-2 py-1 text-left">Mode</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">Stage</th>
                      <th className="px-2 py-1 text-left">Imported</th>
                      <th className="px-2 py-1 text-left">Started</th>
                      <th className="px-2 py-1 text-left">Finished</th>
                      <th className="px-2 py-1 text-left">Metrics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const metrics = (run.cursorsnapshot as any) || {};
                      const gmailQuota = Number(metrics.gmailQuotaUnits || 0);
                      const gmailCalls = Number(metrics.gmailCalls || 0);
                      const outlookCalls = Number(metrics.outlookCalls || 0);
                      const imported = run.importedcount ?? 0;
                      const started = run.startedat
                        ? new Date(run.startedat).toLocaleString()
                        : "";
                      const finished = run.finishedat
                        ? new Date(run.finishedat).toLocaleString()
                        : "";
                      const metricsSummary = [
                        gmailQuota ? `G quota ${gmailQuota}` : "",
                        gmailCalls ? `G calls ${gmailCalls}` : "",
                        outlookCalls ? `O calls ${outlookCalls}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <tr key={run.id} className="border-b last:border-0">
                          <td className="px-2 py-1 align-top">
                            <div className="max-w-[160px] truncate font-mono text-xs">
                              {run.id}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <div className="max-w-[140px] truncate font-mono text-xs">
                              {run.mailboxid}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-top">{run.mode}</td>
                          <td className="px-2 py-1 align-top">{run.status}</td>
                          <td className="px-2 py-1 align-top">
                            {run.stage || ""}
                          </td>
                          <td className="px-2 py-1 align-top">{imported}</td>
                          <td className="px-2 py-1 align-top whitespace-nowrap">
                            {started}
                          </td>
                          <td className="px-2 py-1 align-top whitespace-nowrap">
                            {finished}
                          </td>
                          <td className="px-2 py-1 align-top text-xs text-muted-foreground">
                            {metricsSummary || "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

