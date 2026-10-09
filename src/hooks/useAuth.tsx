import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';
import { logLoginSession } from '@/services/crAccounts';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string, attempts = 3): Promise<Profile | null> {
    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!error && data) {
        setProfile(data as Profile);
        return data as Profile;
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    setProfile(null);
    // No usable profile: drop the session so the app goes to /login instead of spinning forever.
    await supabase.auth.signOut().catch(() => {});
    return null;
  }

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        setSession(data.session);
        if (data.session) await loadProfile(data.session.user.id);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    // IMPORTANT: never await Supabase calls directly inside this callback — it can
    // deadlock the auth client (blank screens, requests that never finish).
    // Defer the profile fetch to the next tick instead.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED') return; // profile unchanged
      setTimeout(() => {
        if (alive) loadProfile(newSession.user.id);
      }, 0);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      // Make sure the profile is in state BEFORE the login page navigates,
      // otherwise ProtectedRoute sees "no profile" and bounces back to /login.
      await loadProfile(data.user.id);
      // Best-effort: never let session logging block or fail a real login.
      logLoginSession(data.user.id).catch(() => {});
    }
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id, 1);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
