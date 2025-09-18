import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo, GmailIcon, OutlookIcon } from '@/components/icons';

export default function ConnectPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b bg-background/80 px-4 md:px-6 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2">
          <AppLogo className="h-8 w-8 text-primary" />
          <span className="font-headline text-lg font-bold">Header Harbor</span>
        </Link>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </header>
      <main className="flex-1">
        <div className="container mx-auto max-w-2xl space-y-6 px-4 py-12">
          <h1 className="font-headline text-3xl font-bold">Connect your mailbox</h1>
          <p className="text-muted-foreground">
            We only index email headers to discover services and support safe unsubscribe. You can disconnect anytime.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <a href="/api/oauth/google/start">
                <GmailIcon className="mr-2 h-5 w-5" /> Connect Google
              </a>
            </Button>
            <Button size="lg" asChild variant="secondary" className="w-full sm:w-auto">
              <a href="/api/oauth/microsoft/start">
                <OutlookIcon className="mr-2 h-5 w-5" /> Connect Microsoft
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Make sure to add the following redirect URIs in your OAuth apps:
            <br />
            Google: https://&lt;your-domain&gt;/api/oauth/google/callback
            <br />
            Microsoft: https://&lt;your-domain&gt;/api/oauth/microsoft/callback
          </p>
        </div>
      </main>
    </div>
  );
}