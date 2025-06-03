
"use client";
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { WickerUser } from '@/lib/types';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { ReactNode } from 'react';
import { createContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

// This is a workaround for Firebase Auth not directly supporting username-only auth.
// We'll use "username@wicker.us.com" as the email.
const formatEmailForFirebase = (username: string) => `${username.toLowerCase()}@wicker.us.com`;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [wickerUser, setWickerUser] = useState<WickerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch WickerUser profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setWickerUser(userDocSnap.data() as WickerUser);
        } else if (!user.isAnonymous) {
          // This case should ideally not happen if signup creates the doc.
          // Could be a new user whose profile doc creation is pending.
          console.warn("WickerUser document not found for UID:", user.uid);
          setWickerUser(null); // Or attempt to create it if necessary
        } else {
            // For anonymous users, we might create a temporary WickerUser profile
            const anonUsername = `Guest-${user.uid.substring(0, 6)}`;
            const anonUser: WickerUser = {
                uid: user.uid,
                username: anonUsername,
                createdAt: serverTimestamp() as any, // Firestore handles this conversion
            };
            await setDoc(userDocRef, anonUser, { merge: true });
            setWickerUser(anonUser);
        }
      } else {
        setWickerUser(null);
        // Try to sign in anonymously if __initial_auth_token is not available (handled by Firebase persistence)
        // The prompt mentions `__initial_auth_token` which is usually for custom auth.
        // For simplicity, if no user, we try anonymous sign-in as a fallback.
        // However, typical flow is: check auth state, if no user, redirect to /auth page.
        // Let's not auto-sign-in anonymously here, but provide a button on auth page.
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const signUp = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const email = formatEmailForFirebase(username);
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      // Create WickerUser document in Firestore
      const wickerUserData: WickerUser = {
        uid: firebaseUser.uid,
        username: username.toLowerCase(), // Store username in lowercase
        createdAt: serverTimestamp() as any, // Firestore handles this conversion
        // publicKey: await generateAndStoreKeyPair() // Implement key generation
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), wickerUserData);
      
      setCurrentUser(firebaseUser);
      setWickerUser(wickerUserData);
      setLoading(false);
      return firebaseUser;
    } catch (error) {
      console.error("Error signing up:", error);
      setLoading(false);
      throw error; // Re-throw to be caught by the form
    }
  };

  const signIn = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const email = formatEmailForFirebase(username);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      // WickerUser data will be fetched by onAuthStateChanged
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
      // WickerUser for anonymous user will be created/fetched by onAuthStateChanged
      setCurrentUser(firebaseUser);
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
      router.push('/auth'); // Redirect to auth page after sign out
    } catch (error) {
      console.error("Error signing out:", error);
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
