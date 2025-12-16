"use client";

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function SettingsPage() {
  const [exportData, setExportData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    const res = await fetch('/api/account/export', { method: 'POST' });
    const j = await res.json();
    setExportData(j);
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    setBusy(false);
    alert(res.ok ? 'Data delete requested.' : 'Delete failed.');
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-headline">Privacy Controls</CardTitle>
          <CardDescription>Export or delete your account data.</CardDescription>
        </CardHeader>
      </Card>

      <div className="flex gap-3 mb-4">
        <Button onClick={handleExport} disabled={busy}>Export Data</Button>
        <Button variant="destructive" onClick={handleDelete} disabled={busy}>Delete My Data</Button>
      </div>

      {exportData && (
        <pre className="rounded-md border p-4 text-xs overflow-auto">{JSON.stringify(exportData, null, 2)}</pre>
      )}
    </div>
  );
}

