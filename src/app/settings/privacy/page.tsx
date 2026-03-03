"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useRequireAuth } from "@/hooks/use-auth";

export default function SettingsPrivacyPage() {
  const { user, loading } = useRequireAuth();

  if (loading || !user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Privacy</CardTitle>
          <CardDescription>
            Atlas indexes headers only by default and gives you control over what is stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            We only index email headers (From, To, Subject, Date, List-Unsubscribe, List-Unsubscribe-Post,
            DKIM-Signature, Authentication-Results). We do not store or process email bodies.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Gmail scopes: gmail.metadata (preferred) or gmail.readonly for header indexing.</li>
            <li>Microsoft Graph scope: Mail.Read for header indexing.</li>
            <li>Tokens are encrypted at rest using AES-256-GCM and stored in Supabase Postgres.</li>
            <li>You can disconnect your mailbox at any time from Settings → Connections.</li>
            <li>We respect RFC 8058 one-click unsubscribe where provided by senders.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            For production, ensure your Google app is verified for restricted scopes if applicable, and
            maintain a clear, public privacy policy at /privacy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

