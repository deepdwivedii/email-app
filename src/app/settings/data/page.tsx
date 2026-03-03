"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";

export default function SettingsDataPage() {
  const { user, loading } = useRequireAuth();
  const [exportData, setExportData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !user) {
    return null;
  }

  const handleExport = async () => {
    setBusy(true);
    const res = await fetch("/api/account/export", { method: "POST" });
    const j = await res.json();
    setExportData(j);
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    setBusy(false);
    alert(res.ok ? "Data delete requested." : "Delete failed.");
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-headline">Data</CardTitle>
          <CardDescription>Export a copy of your data or request deletion.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExport} disabled={busy}>
            Export data
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            Delete my data
          </Button>
        </CardContent>
      </Card>

      {exportData && (
        <pre className="mt-4 max-h-[320px] overflow-auto rounded-md border p-4 text-xs">
          {JSON.stringify(exportData, null, 2)}
        </pre>
      )}
    </div>
  );
}

