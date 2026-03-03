"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useRequireAuth } from "@/hooks/use-auth";
import Link from "next/link";

export default function SettingsAdvancedPage() {
  const { user, loading } = useRequireAuth();

  if (loading || !user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Advanced</CardTitle>
          <CardDescription>
            Tools for debugging and power users. These views are optional and can be ignored in daily use.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              <Link href="/settings/advanced/messages" className="hover:underline">
                Raw messages
              </Link>
            </CardTitle>
            <CardDescription>
              Inspect header-only message rows used to build subscriptions and accounts.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              <Link href="/api/diagnostics/supabase" className="hover:underline">
                Diagnostics
              </Link>
            </CardTitle>
            <CardDescription>
              Low-level information about your database connectivity and environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Opens a JSON diagnostics endpoint in a new tab.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

