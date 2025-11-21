// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  writeBatch
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

// 🔧 FIX lỗi “client is offline”:
// ép Firestore dùng long-polling, tránh các vấn đề với websockets/proxy
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

console.log("✅ Firebase + Firestore Module Initialized (long-polling enabled).");

// Export các hàm và đối tượng cần thiết
export { db, collection, getDocs, getDoc, doc, setDoc, deleteDoc, writeBatch };
