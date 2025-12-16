"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export default function MainNav() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return null;
  }

  return (
    <>
      <div className="flex items-center md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 sm:w-80">
            <div className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Main menu</SheetDescription>
            </div>
            <nav className="mt-6 flex flex-col gap-2 text-sm font-medium text-muted-foreground">
              <SheetClose asChild>
                <Link
                  href="/dashboard"
                  prefetch={false}
                  className="rounded-full px-3 py-2 transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  Dashboard
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/accounts"
                  prefetch={false}
                  className="rounded-full px-3 py-2 transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  Accounts
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/mailboxes"
                  prefetch={false}
                  className="rounded-full px-3 py-2 transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  Mailboxes
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/tasks"
                  prefetch={false}
                  className="rounded-full px-3 py-2 transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  Tasks
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/settings"
                  prefetch={false}
                  className="rounded-full px-3 py-2 transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  Settings
                </Link>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      <nav className="hidden items-center gap-3 text-xs font-medium text-muted-foreground md:flex md:gap-4 md:text-sm">
        <Link
          href="/dashboard"
          prefetch={false}
          className="rounded-full px-3 py-1 transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          Dashboard
        </Link>
        <Link
          href="/accounts"
          prefetch={false}
          className="rounded-full px-3 py-1 transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          Accounts
        </Link>
        <Link
          href="/mailboxes"
          prefetch={false}
          className="rounded-full px-3 py-1 transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          Mailboxes
        </Link>
        <Link
          href="/tasks"
          prefetch={false}
          className="rounded-full px-3 py-1 transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          Tasks
        </Link>
        <Link
          href="/settings"
          prefetch={false}
          className="rounded-full px-3 py-1 transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          Settings
        </Link>
      </nav>
    </>
  );
}
