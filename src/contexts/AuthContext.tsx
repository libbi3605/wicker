
"use client";
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { WickerUser } from '@/lib/types';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { ReactNode } from 'react';
import { createContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  wickerUser: WickerUser | null;
  loading: boolean;
  signUp: (username: string, pass: string) => Promise<FirebaseUser | null>;
  signIn: (username:string, pass: string) => Promise<FirebaseUser | null>;
  signOut: () => Promise<void>;
  signInAsGuest: () => Promise<FirebaseUser | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatEmailForFirebase = (username: string) => `${username.toLowerCase()}@wicker.app`; // Changed domain for uniqueness

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [wickerUser, setWickerUser] = useState<WickerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setWickerUser(userDocSnap.data() as WickerUser);
          } else if (user.isAnonymous) {
            const baseAnonUsername = `Guest-${user.uid.substring(0, 6)}`;
            const anonUsername = baseAnonUsername.toLowerCase();
            const anonUser: WickerUser = {
                uid: user.uid,
                username: anonUsername,
                createdAt: serverTimestamp() as any,
            };
            await setDoc(userDocRef, anonUser, { merge: true });
            setWickerUser(anonUser);
          } else {
            console.warn("WickerUser document not found for UID:", user.uid, "User is not anonymous.");
            setWickerUser(null); 
          }
        } catch (error: any) {
          console.error("Error fetching user document in AuthContext:", error);
          toast({
            title: "Profile Error",
            description: "Could not load your profile. You might be offline or an error occurred.",
            variant: "destructive",
          });
          setWickerUser(null);
        }
      } else {
        setWickerUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  const signUp = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const email = formatEmailForFirebase(username);
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const wickerUserData: WickerUser = {
        uid: firebaseUser.uid,
        username: username.toLowerCase(),
        createdAt: serverTimestamp() as any,
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), wickerUserData);
      
      setCurrentUser(firebaseUser);
      setWickerUser(wickerUserData);
      setLoading(false);
      return firebaseUser;
    } catch (error) {
      console.error("Error signing up:", error);
      setLoading(false);
      throw error;
    }
  };

  const signIn = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const email = formatEmailForFirebase(username);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      setCurrentUser(firebaseUser);
      setLoading(false);
      return firebaseUser;
    } catch (error) {
      console.error("Error signing in:", error);
      setLoading(false);
      throw error;
    }
  };
  
  const signInAsGuest = async () => {
    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      const firebaseUser = userCredential.user;
      setCurrentUser(firebaseUser);
      // Toast for guest sign-in is now handled in AuthPage.tsx for immediate feedback
      setLoading(false);
      return firebaseUser;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
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
