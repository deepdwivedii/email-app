"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <CardTitle className="font-headline text-xl">Loading auth…</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-muted-foreground">
                Preparing the sign-in experience.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const [tab, setTab] = useState<"signin" | "signup">(initialTab as "signin" | "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const from = searchParams.get("from") || "/";

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    qp.set("tab", tab);
    const base = window.location.pathname;
    const next = qp.toString() ? `${base}?${qp.toString()}` : base;
    window.history.replaceState({}, "", next);
  }, [tab]);

  useEffect(() => {
    if (!authLoading && user) {
      const onboarded =
        typeof window !== "undefined" &&
        window.localStorage.getItem("atlas:onboarded") === "true";
      const target = onboarded ? "/overview" : "/onboarding";
      router.replace(target);
    }
  }, [authLoading, user, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error("Supabase client not initialized");
      }
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description: error?.message || "Check your details and try again.",
      });
      setBusy(false);
    }
  };

  const handleMagicLink = async () => {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error("Supabase client not initialized");
      }
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
      toast({
        title: "Check your email",
        description: "We sent you a magic link to sign in.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Magic link failed",
        description: error?.message || "Try again in a moment.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github" | "azure") => {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error("Supabase client not initialized");
      }
      await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/auth/callback` },
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Provider sign-in failed",
        description: error?.message || "Try another method.",
      });
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const origin = window.location.origin;
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error("Supabase client not initialized");
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
      if (data.user && !data.session) {
        toast({
          title: "Check your email",
          description: "We sent you a confirmation email. After confirming, return here to sign in.",
        });
        setBusy(false);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign-up failed",
        description: error?.message || "Please try again.",
      });
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <CardTitle className="font-headline text-xl">Checking your session…</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm text-muted-foreground">
              Hold on while we verify if you are already signed in.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <CardTitle className="font-headline text-xl">Redirecting…</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm text-muted-foreground">
              You are already signed in. Taking you to your dashboard.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="font-headline text-2xl">Welcome to Atlas</CardTitle>
          <CardDescription>
            {from && from !== "/"
              ? "You need to sign in to view this page."
              : "Sign in or create an account to start scanning your inbox."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="space-y-4">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4" aria-label="Sign in form">
                <div className="grid gap-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleMagicLink}
                    disabled={busy || !email}
                  >
                    Send magic link
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOAuth("google")}
                      disabled={busy}
                    >
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOAuth("github")}
                      disabled={busy}
                    >
                      GitHub
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOAuth("azure")}
                      disabled={busy}
                    >
                      Microsoft
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4" aria-label="Create account form">
                <div className="grid gap-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You will get a confirmation email. After confirming, you will return here to sign in.
                </p>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <p>
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
