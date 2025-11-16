"use client";
import { createClient } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WickerUser } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AuthContextType {
  currentUser: any;
  wickerUser: WickerUser | null;
  loading: boolean;
  signUp: (username: string, pass: string) => Promise<any>;
  signIn: (username: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
  signInAsGuest: () => Promise<any>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatEmailForSupabase = (username: string) => `${username.toLowerCase()}@localhost.test`
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [wickerUser, setWickerUser] = useState<WickerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  // Listen to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user;
        setCurrentUser(user);

        if (user) {
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select('*')
              .eq('uid', user.id)
              .single();

            if (error && error.code === 'PGRST116') {
              // User doesn't exist, create them
              if (user.user_metadata?.is_anonymous) {
                const baseAnonUsername = `Guest-${user.id.substring(0, 6)}`;
                const anonUser: WickerUser = {
                  uid: user.id,
                  username: baseAnonUsername.toLowerCase(),
                  createdAt: new Date().toISOString(),
                };
                await supabase.from('users').insert([anonUser]);
                setWickerUser(anonUser);
              }
            } else if (userData) {
              setWickerUser(userData as WickerUser);
            }
          } catch (err: any) {
            console.error('Error fetching user:', err);
            toast({
              title: 'Profile Error',
              description: 'Could not load your profile.',
              variant: 'destructive',
            });
          setLoading(false);
    );

    return () => subscription?.unsubscribe();
  }, [toast]);

  const signUp = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const email = formatEmailForSupabase(username);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
      });

      if (error) throw error;
      const user = data.user;

      if (user) {
        const wickerUserData: WickerUser = {
          uid: user.id,
          username: username.toLowerCase(),
          createdAt: new Date().toISOString(),
        };
        await supabase.from('users').insert([wickerUserData]);
        setCurrentUser(user);
        setWickerUser(wickerUserData);
      }
      return user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
      finally { setLoading(false); }
  };

  const signIn = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const email = formatEmailForSupabase(username);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) throw error;
      const user = data.user;
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
      finally { setLoading(false); }
  };

  const signInAsGuest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      const user = data.user;
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      throw error;
    }
      finally { setLoading(false); }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setWickerUser(null);
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Sign Out Error',
        description: 'Could not sign out properly.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    wickerUser,
    loading,
    signUp,
    signIn,
    signOut,
    signInAsGuest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
