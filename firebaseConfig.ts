// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  enableIndexedDbPersistence
} from "firebase/firestore";

// Cấu hình Firebase của bạn
const firebaseConfig = {
  apiKey: "AIzaSyDGOK3sa0n5VvNtWdjxau9gU1W0VfSJvo0",
  authDomain: "q-home-8e308.firebaseapp.com",
  projectId: "q-home-8e308",
  storageBucket: "q-home-8e308.firebasestorage.app",
  messagingSenderId: "384500171554",
  appId: "1:384500171554:web:32d44fe7fa5a5d044bdb7b",
  measurementId: "G-2W527EESGR"
};

// Khởi tạo app
const app = initializeApp(firebaseConfig);

// 🔧 FIX for Vercel deployment:
// Removed experimentalForceLongPolling and reverted to standard initialization.
// This allows Firebase to use WebSockets for a stable connection on Vercel.
const db = getFirestore(app);

// Bật tính năng offline persistence (good for production)
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firebase persistence couldn't be enabled. It's likely another tab is open with persistence enabled.");
    } else if (err.code === 'unimplemented') {
      console.warn("The browser doesn't support all of the features required to enable persistence.");
    }
  });


console.log("✅ Firebase + Firestore Initialized (standard connection, offline persistence).");

// Export các hàm và đối tượng cần thiết
export { db, collection, getDocs, getDoc, doc, setDoc, deleteDoc, writeBatch };