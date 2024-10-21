// src/firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyCSwHnNB5YMHtfPlOUQ3kSoN685Hi4raBM",
    authDomain: "chatsitee.firebaseapp.com",
    projectId: "chatsitee",
    storageBucket: "chatsitee.appspot.com",
    messagingSenderId: "926728879772",
    appId: "1:926728879772:web:5a53719c9da1a4c6a07759",
    measurementId: "G-27F28MWQ00"
  };
  
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;