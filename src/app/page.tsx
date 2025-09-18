import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AppLogo, GmailIcon, OutlookIcon } from '@/components/icons';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b bg-background/80 px-4 md:px-6 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2">
          <AppLogo className="h-8 w-8 text-primary" />
          <span className="font-headline text-lg font-bold">Header Harbor</span>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild>
            <Link href="/connect">Connect</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <section className="relative h-[60vh] w-full">
          <Image
            src="https://picsum.photos/seed/1/1800/1200"
            alt="Abstract background image of colorful waves"
            fill
            className="object-cover"
            priority
            data-ai-hint="calm abstract waves"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center space-y-6 text-center text-foreground">
            <h1 className="font-headline text-4xl font-bold md:text-6xl">
              Reclaim Your Inbox
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
              Header Harbor analyzes your email headers to identify and help you
              unsubscribe from unwanted newsletters and marketing lists.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/connect">
                  <GmailIcon className="mr-2 h-5 w-5" /> Connect with Gmail
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
                <Link href="/connect">
                  <OutlookIcon className="mr-2 h-5 w-5" /> Connect with Outlook
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Header Harbor. All rights reserved. ·{' '}
          <Link href="/privacy" className="underline">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
