import { AppLogo, GmailIcon, OutlookIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center text-center">
        <AppLogo className="h-24 w-24 text-primary" />
        <h1 className="mt-6 font-headline text-5xl font-bold tracking-tighter">
          Header Harbor
        </h1>
        <p className="mt-2 max-w-lg text-lg text-muted-foreground">
          Reclaim your inbox, one header at a time. Connect your account to get started.
        </p>
      </div>

      <Card className="mt-12 w-full max-w-sm">
        <CardHeader className='text-center'>
          <CardTitle className="font-headline text-xl">Connect Your Mailbox</CardTitle>
          <CardDescription>
            Choose your provider to securely sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
           <Button variant="outline" size="lg" asChild>
            <Link href="/api/oauth/google/start">
              <GmailIcon className="mr-2 h-5 w-5" /> Connect with Gmail
            </Link>
          </Button>
           <Button variant="outline" size="lg" asChild>
            <Link href="/api/oauth/microsoft/start">
              <OutlookIcon className="mr-2 h-5 w-5" /> Connect with Outlook
            </Link>
          </Button>
        </CardContent>
      </Card>

      <footer className="mt-16 text-center text-sm text-muted-foreground">
        <p>
          We only access email headers, never the content. Your privacy is our priority.
        </p>
        <Link href="/privacy" className="mt-1 inline-block text-xs underline">
          Learn more
        </Link>
      </footer>
    </main>
  );
}
