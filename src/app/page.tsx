import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-background via-background/60 to-background">
      <div className="pointer-events-none absolute inset-x-0 top-[-10rem] -z-10 flex justify-center">
        <div className="h-72 w-[40rem] rounded-full bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.4),_transparent_60%)] blur-3xl" />
      </div>
      <div className="pointer-events-none absolute left-[-10rem] top-1/3 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(244,114,182,0.5),_transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-1/2 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(129,140,248,0.55),_transparent_60%)] blur-3xl" />

      <main className="flex-1">
        <section className="px-4">
          <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col items-center justify-center gap-12 py-16 md:flex-row md:items-center md:justify-between">
            <div className="space-y-8 text-center md:max-w-xl md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/70 px-4 py-1 text-[0.7rem] font-medium uppercase tracking-[0.26em] text-muted-foreground shadow-sm backdrop-blur">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-primary via-emerald-400 to-fuchsia-500 text-[0.7rem] text-primary-foreground shadow-sm">
                  <Sparkles className="h-3 w-3" />
                </span>
                <span>Your digital accounts, carried in one place.</span>
              </div>
              <div className="space-y-4">
                <h1 className="font-headline text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                  Turn newsletter chaos into{" "}
                  <span className="bg-gradient-to-r from-primary via-emerald-400 to-fuchsia-500 bg-clip-text text-transparent">
                    signal
                  </span>
                  .
                </h1>
                <p className="text-base text-muted-foreground sm:text-lg md:text-xl">
                  Let Atlas auto-detect subscriptions, clean up your inbox, and
                  keep the stuff you actually vibe with.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-start">
                <Button
                  size="lg"
                  asChild
                  className="w-full sm:w-auto bg-gradient-to-r from-primary via-emerald-400 to-fuchsia-500 text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-[1.02] hover:shadow-primary/60"
                >
                  <Link href="/signup">
                    Get started free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="w-full sm:w-auto border-border/60 bg-background/80 text-foreground/90 backdrop-blur hover:bg-background"
                >
                  <Link href="/login">Peek the dashboard</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                No credit card. Just connect your inbox and reclaim your energy.
              </p>
            </div>

            <div className="w-full max-w-md shrink-0 md:max-w-lg">
              <Card className="relative overflow-hidden border-none bg-background/80 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur">
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/40 via-transparent to-transparent" />
                <CardContent className="relative space-y-6 p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Live snapshot
                      </p>
                      <p className="text-sm font-medium">Your inbox, decoded</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      Real-time
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-background/90 px-3 py-2">
                      <span className="text-muted-foreground">
                        Subscriptions detected
                      </span>
                      <span className="font-semibold">143</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-background/90 px-3 py-2">
                      <span className="text-muted-foreground">
                        One-tap unsubscribes
                      </span>
                      <span className="font-semibold text-emerald-400">
                        87 cleared
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-background/90 px-3 py-2">
                      <span className="text-muted-foreground">
                        Focused senders
                      </span>
                      <span className="font-semibold text-primary">
                        12 favorites
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Atlas reads your email headers to spot patterns, surface the
                    noise, and let you batch-clean in minutes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-background/80">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:py-16">
            <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
              <h2 className="font-headline text-2xl font-semibold md:text-3xl">
                Built for inbox-maxed humans
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground md:text-base">
                Whether you are signed up to every launch waitlist or just tired
                of promos, Atlas gives you the receipts on who is spamming you
                and how to shut it down.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-border/60 bg-background/90">
                <CardContent className="space-y-3 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Zero inbox anxiety
                  </p>
                  <p className="text-sm text-foreground">
                    See every newsletter and marketing list in one clean view,
                    instead of hunting through endless threads.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-background/90">
                <CardContent className="space-y-3 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Gen Z energy
                  </p>
                  <p className="text-sm text-foreground">
                    Bright gradients, soft edges, and a layout designed to feel
                    like the apps you actually enjoy using.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-background/90">
                <CardContent className="space-y-3 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Built for speed
                  </p>
                  <p className="text-sm text-foreground">
                    Clean, focused UI that keeps the important decisions front
                    and center, so you can bounce in and out fast.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/90 py-6">
          <div className="container mx-auto px-4 text-center text-xs text-muted-foreground md:text-sm">
            © {new Date().getFullYear()} Atlas. All rights reserved. ·{" "}
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
          </div>
      </footer>
    </div>
  );
}
