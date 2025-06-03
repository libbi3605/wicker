
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// IMPORTANT: These values are now populated with your Firebase project configuration.
// For better security and different environments, consider using environment variables.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAcnT9ElZuLxUIXv90yR3_eyVm7B5HJo8Y",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "wicker-118fc.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "wicker-118fc",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "wicker-118fc.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "31086279439",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:31086279439:web:d972163e58184aac3e9c7a",
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// Enable Firestore offline persistence
if (typeof window !== 'undefined') { // Ensure this only runs in the browser
  enableIndexedDbPersistence(db, { cacheSizeBytes: CACHE_SIZE_UNLIMITED })
    .then(() => {
      console.log("Firestore offline persistence enabled.");
    })
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn("Firestore offline persistence failed: Multiple tabs open or other precondition failed.");
      } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn("Firestore offline persistence failed: Browser does not support required features.");
      } else {
        console.error("Firestore offline persistence failed with error: ", err);
      }
    });
}

export { app, auth, db, storage };
