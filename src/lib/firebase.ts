
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// IMPORTANT: Replace the placeholder values below with your actual Firebase project configuration.
// You can find these details in your Firebase project settings in the Firebase console.
// Go to Project settings > General > Your apps > Web app > SDK setup and configuration.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "__firebase_config.apiKey", // Replace with your API key
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "__firebase_config.authDomain", // Replace with your auth domain
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "__firebase_config.projectId", // Replace with your project ID
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "__firebase_config.storageBucket", // Replace with your storage bucket
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "__firebase_config.messagingSenderId", // Replace with your messaging sender ID
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "__firebase_config.appId", // Replace with your app ID
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

export { app, auth, db, storage };
