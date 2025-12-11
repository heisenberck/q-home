importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBQ1CO4ZzCVecXgN8Cn6Idvrmudm7y-lbA",
  authDomain: "q-home2.firebaseapp.com",
  projectId: "q-home2",
  storageBucket: "q-home2.firebasestorage.app",
  messagingSenderId: "761941461134",
  appId: "1:761941461134:web:8ace84c20573a27700e1df"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});