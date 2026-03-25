import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isSystemAdminEmail } from '@/lib/system-admin';

type SupabaseAuthInternals = {
  _removeSession?: () => Promise<void>;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, nome: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: nome
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      return { error: null };
    }

    const normalizedMessage = error.message.trim().toLowerCase();
    const shouldFallbackToLocalSignOut =
      normalizedMessage.includes("session") &&
      (normalizedMessage.includes("missing") ||
        normalizedMessage.includes("not found"));

    if (shouldFallbackToLocalSignOut) {
      try {
        const authClient = supabase.auth as SupabaseAuthInternals;

        if (typeof authClient._removeSession === "function") {
          await authClient._removeSession();
        }

        setSession(null);
        setUser(null);

        return { error: null };
      } catch {
        setSession(null);
        setUser(null);

        return { error: null };
      }
    }

    return { error };
  };

  const updatePassword = async (password: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password,
      data: {
        ...(user?.user_metadata || {}),
        temporary_password: false,
      },
    });

    if (!error) {
      const {
        data: { session: refreshedSession },
      } = await supabase.auth.getSession();
      setSession(refreshedSession);
      setUser(refreshedSession?.user ?? data.user ?? null);
    }

    return { error, user: data.user ?? null };
  };

  const email = user?.email?.trim().toLowerCase() ?? null;
  const isSystemAdmin = isSystemAdminEmail(email);
  const requiresPasswordChange = Boolean(user?.user_metadata?.temporary_password);

  return {
    user,
    session,
    email,
    loading,
    isSystemAdmin,
    requiresPasswordChange,
    signUp,
    signIn,
    signOut,
    updatePassword,
  };
}
