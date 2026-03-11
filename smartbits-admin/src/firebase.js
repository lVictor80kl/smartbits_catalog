import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC9g1nrEMFZfG8u8wzYhViktyJmuvPD-bA",
  authDomain: "smartbits-catalog.firebaseapp.com",
  projectId: "smartbits-catalog",
  storageBucket: "smartbits-catalog.firebasestorage.app",
  messagingSenderId: "656525466019",
  appId: "1:656525466019:web:c2ca14427c5c1f350de216",
  measurementId: "G-3J86R9NX3Q"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

