"use client";
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { WickerUser, UserProfile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import type { ReactNode } from 'react';
import { createContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: SupabaseUser | null;
  wickerUser: WickerUser | null;
  loading: boolean;
  signUp: (username: string, pass: string) => Promise<WickerUser | null>;
  signIn: (username: string, pass: string) => Promise<WickerUser | null>;
  signOut: () => Promise<void>;
  signInAsGuest: () => Promise<WickerUser | null>;
}

const DUMMY_EMAIL_DOMAIN = 'wicker.app';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [wickerUser, setWickerUser] = useState<WickerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchUserProfile = useCallback(async (user: SupabaseUser): Promise<UserProfile | null> => {
    const { data: user_profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116: "exact one row was not found"
      console.error("Error fetching user profile:", error);
      toast({
        title: "Profile Error",
        description: "Could not load your profile.",
        variant: "destructive",
      });
      return null;
    }
    return user_profile;
  }, [supabase, toast]);


  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);

      if (user) {
        const profile = await fetchUserProfile(user);
        if (profile) {
          setWickerUser({ ...user, user_profile: profile });
        } else {
          // This case might happen for a guest user on their very first load
           if (user.is_anonymous) {
             const baseAnonUsername = `Guest-${user.id.substring(0, 6)}`;
             const { data: newProfile, error: insertError } = await supabase
              .from('users')
              .insert({ id: user.id, username: baseAnonUsername })
              .select()
              .single();

            if (insertError) {
                console.error("Error creating guest profile:", insertError);
                setWickerUser(null);
            } else {
                setWickerUser({ ...user, user_profile: newProfile });
            }
           } else {
              // This might be a regular user whose profile trigger failed.
              // We'll wait for sign-up/sign-in logic to handle it.
              setWickerUser(null);
           }
        }
      } else {
        setWickerUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  const signUp = async (username: string, password: string) => {
    setLoading(true);
    const email = `${username.toLowerCase()}@${DUMMY_EMAIL_DOMAIN}`;

    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });

    if (signUpError) {
      console.error("Error signing up:", signUpError);
      setLoading(false);
      // Provide a more user-friendly error message
      if (signUpError.message.includes('User already registered')) {
        throw new Error('This username is already taken.');
      }
      throw signUpError;
    }
    if (!user) {
        setLoading(false);
        throw new Error("Sign up successful, but no user returned.");
    }
    
    // The user profile is now created via a trigger in Supabase,
    // so we just need to fetch it.
    // We add a small delay to give the trigger time to run.
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const profile = await fetchUserProfile(user);
    if (!profile) {
        setLoading(false);
        throw new Error("User created, but profile could not be found.");
    }
    const signedInWickerUser = { ...user, user_profile: profile };
    setWickerUser(signedInWickerUser);
    setCurrentUser(user);
    setLoading(false);
    return signedInWickerUser;
  };

  const signIn = async (username: string, password: string) => {
    setLoading(true);
    const email = `${username.toLowerCase()}@${DUMMY_EMAIL_DOMAIN}`;
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Error signing in:", error);
      setLoading(false);
      throw error;
    }
    if (!user) {
        setLoading(false);
        throw new Error("Sign in successful, but no user returned.");
    }
    
    const profile = await fetchUserProfile(user);
     if (!profile) {
        setLoading(false);
        throw new Error("User signed in, but profile could not be found.");
    }
    const signedInWickerUser = { ...user, user_profile: profile };
    setWickerUser(signedInWickerUser);
    setCurrentUser(user);
    setLoading(false);
    return signedInWickerUser;
  };

  const signInAsGuest = async () => {
    setLoading(true);
    const { data: { user }, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error("Error signing in as guest:", error);
      setLoading(false);
      throw error;
    }
    if (!user) {
      setLoading(false);
      throw new Error("Guest sign in successful, but no user returned.");
    }

    // The onAuthStateChange handler will create the guest profile if it doesn't exist.
    // We can just wait for it to be set.
    await new Promise(resolve => setTimeout(resolve, 500));
    const profile = await fetchUserProfile(user);
    const guestWickerUser = { ...user, user_profile: profile || { id: user.id, username: `Guest-${user.id.substring(0,6)}`, created_at: new Date().toISOString() }};
    setWickerUser(guestWickerUser);
    setCurrentUser(user);

    setLoading(false);
    return guestWickerUser;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setWickerUser(null);
      router.push('/auth');
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: "Sign Out Error", description: "Could not sign out properly.", variant: "destructive" });
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
