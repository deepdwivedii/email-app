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
        <Button variant="outline" asChild>
          <Link href="/dashboard">Continue to Dashboard</Link>
        </Button>
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
          </div>
        </section>
        <section className="py-12 md:py-24">
          <div className="container mx-auto max-w-4xl space-y-8 px-4 text-center">
            <h2 className="font-headline text-3xl font-bold">
              Connect Your Account
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Securely connect your Gmail or Outlook account to get started. We
              only ever read email headers, never the content of your emails.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto">
                <GmailIcon className="mr-2 h-5 w-5" />
                Connect with Gmail
              </Button>
              <Button size="lg" className="w-full sm:w-auto">
                <OutlookIcon className="mr-2 h-5 w-5" />
                Connect with Outlook
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Header Harbor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
