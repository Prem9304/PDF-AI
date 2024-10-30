// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCYWKzupwhrdyaQxFIViQxuJcn0OMDSdMY",
  authDomain: "pdf-ai-4d404.firebaseapp.com",
  projectId: "pdf-ai-4d404",
  storageBucket: "pdf-ai-4d404.appspot.com",
  messagingSenderId: "884890977581",
  appId: "1:884890977581:web:2ad41ce7f7d640fd787fa4",
  measurementId: "G-ZMGYCEHXE7"
};
  
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;