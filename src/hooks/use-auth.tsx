"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';

interface AuthContextType {
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const client = await getSupabaseClient();
      if (!mounted) return;
      if (!client) {
        console.error('Supabase client not initialized; auth is disabled.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await client.auth.getSession();
        if (!mounted) return;
        if (error) {
          setUser(null);
        } else {
          setUser(data.session?.user ?? null);
        }
      } catch (error: any) {
        if (
          error?.name !== 'AuthSessionMissingError' &&
          !(typeof error?.message === 'string' && error.message.includes('Auth session missing'))
        ) {
          console.error('Error loading auth user', error);
        }
        if (
          error?.name === 'AuthApiError' &&
          typeof error.message === 'string' &&
          error.message.includes('Invalid Refresh Token')
        ) {
          try {
            await client.auth.signOut();
          } catch (signOutError) {
            console.error('Error signing out after invalid refresh token', signOutError);
          }
        }
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    let unsub: (() => void) | null = null;
    (async () => {
      const client = await getSupabaseClient();
      if (!mounted || !client) return;
      const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      unsub = () => sub?.subscription.unsubscribe();
    })();

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const useRequireAuth = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const from = pathname || '/';
      router.push(`/auth?from=${encodeURIComponent(from)}`);
    }
  }, [user, loading, router, pathname]);

  return { user, loading };
};
