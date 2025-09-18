"use client";

import useSWR from 'swr';
import DomainTable from '@/components/domain-table';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR('/api/inventory', fetcher);
  const domains = data?.domains ?? [];
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">Failed to load inventory</div>
      ) : (
        <DomainTable domains={domains} />
      )}
    </div>
  );
}