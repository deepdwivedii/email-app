"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "./ui/button";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function AuthButton() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
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
        <Link href="/login">Login</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/signup">Sign Up</Link>
      </Button>
    </div>
  );
}
