import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBQ1CO4ZzCVecXgN8Cn6Idvrmudm7y-lbA",
  authDomain: "q-home2.firebaseapp.com",
  projectId: "q-home2",
  storageBucket: "q-home2.firebasestorage.app",
  messagingSenderId: "761941461134",
  appId: "1:761941461134:web:8ace84c20573a27700e1df"
};

// 1. Initialize App
// Standard modular initialization
const app = initializeApp(firebaseConfig);

// 2. Initialize Firestore
// Standard modular initialization
const db = getFirestore(app);

// 3. Initialize Auth
// Standard modular initialization
const auth = getAuth(app);

// 4. Initialize Messaging
let messaging: any = null;
try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        messaging = getMessaging(app);
    }
} catch (err) {
    console.warn("Firebase Messaging failed to initialize:", err);
}

const VAPID_KEY = "BABQ1CfvtLt5ufsa-qOjtA5rGdfvlk8S7JwybGCMmnc2YR9FU44qz-oGXZdxBcLlzkExjPt5eR-2W6WVeV-juX58";

export const requestForToken = async () => {
    if (!messaging) return null;
    try {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
            return currentToken;
        } else {
            console.log('No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
        return null;
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        if (!messaging) return;
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });

export { db, auth, app, messaging };