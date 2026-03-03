"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRequireAuth } from "@/hooks/use-auth";
import Link from "next/link";

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();

  if (loading || !user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-headline">Settings</CardTitle>
          <CardDescription>
            Manage connections, privacy, data export, and advanced tools.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              <Link href="/settings/connections" className="hover:underline">
                Connections
              </Link>
            </CardTitle>
            <CardDescription>
              View connected inboxes, set the active mailbox, and control sync.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              <Link href="/settings/privacy" className="hover:underline">
                Privacy
              </Link>
            </CardTitle>
            <CardDescription>
              Learn how Atlas handles headers-only indexing and scopes.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              <Link href="/settings/data" className="hover:underline">
                Data
              </Link>
            </CardTitle>
            <CardDescription>
              Export a copy of your data or request deletion.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-base">
              <Link href="/settings/advanced" className="hover:underline">
                Advanced
              </Link>
            </CardTitle>
            <CardDescription>
              Access raw messages and diagnostics for troubleshooting.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
