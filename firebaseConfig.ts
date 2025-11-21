// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyDGOK3sa0n5VvNtWdjxau9gU1W0VfSJvo0",
  authDomain: "q-home-8e308.firebaseapp.com",
  projectId: "q-home-8e308",
  storageBucket: "q-home-8e308.appspot.com",
  messagingSenderId: "384500171554",
  appId: "1:384500171554:web:32d44fe7fa5a5d044bdb7b",
  measurementId: "G-2W527EESGR"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { db };