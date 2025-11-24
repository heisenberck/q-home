// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Cấu hình MỚI (Project q-home2)
const firebaseConfig = {
    apiKey: "AIzaSyBQ1CO4ZzCVecXgN8Cn6Idvrmudm7y-lbA",
    authDomain: "q-home2.firebaseapp.com",
    projectId: "q-home2",
    storageBucket: "q-home2.firebasestorage.app",
    messagingSenderId: "761941461134",
    appId: "1:761941461134:web:8ace84c20573a27700e1df"
};

// 1. Khởi tạo App
const app = initializeApp(firebaseConfig);

// 2. Khởi tạo Firestore (Chuẩn Native Mode, KHÔNG dùng Persistence để tránh lỗi cache trên Vercel)
const db = getFirestore(app);

// 3. Khởi tạo Auth
const auth = getAuth(app);

export { db, auth, app };
