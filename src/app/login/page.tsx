"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Redirect is now handled by the useEffect hook
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: origin },
      });
      if (error) throw error;
      toast({
        title: "Check your email",
        description: "We sent you a magic link to sign in.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Magic Link Failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github' | 'azure') => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: origin },
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "OAuth Sign-In Failed",
        description: error.message,
      });
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return null; // Prevent flicker or showing login page to logged-in users
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Login</CardTitle>
          <CardDescription>Enter your email below to login to your account.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleMagicLink} disabled={loading || !email}>
              Send Magic Link
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="secondary" onClick={() => handleOAuth('google')} disabled={loading}>
                Google
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleOAuth('github')} disabled={loading}>
                GitHub
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleOAuth('azure')} disabled={loading}>
                Microsoft
              </Button>
            </div>
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="underline">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
