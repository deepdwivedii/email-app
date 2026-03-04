"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "./ui/button";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function AuthButton() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const client = await getSupabaseClient();
    if (!client) {
      console.error("Supabase client not initialized; cannot sign out.");
      router.push("/");
      return;
    }
    await client.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />;
  }

  if (user) {
    return (
      <Button onClick={handleSignOut} variant="ghost" size="sm">
        Sign Out
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/auth?tab=signin">Sign In</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/auth?tab=signup">Get started</Link>
      </Button>
    </div>
  );
}
