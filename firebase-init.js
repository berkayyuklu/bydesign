// firebase-init.js
// Firebase SDK (modular v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAMpUCVBapMKcvCrtacovlBcjGUz3PzmBs",
  authDomain:        "bydesign-bc4a2.firebaseapp.com",
  projectId:         "bydesign-bc4a2",
  storageBucket:     "bydesign-bc4a2.firebasestorage.app",
  messagingSenderId: "285288103439",
  appId:             "1:285288103439:web:0d298f6b57fe61b727ed7a",
  measurementId:     "G-KXZ9FE8KYG"
};

const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const analytics = getAnalytics(app);

// Export so other modules can import
export { app, auth, db, analytics };
