import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQKapljLgUujBEhJnAPLFOmv09baFziBo",
  authDomain: "hk-runner.firebaseapp.com",
  projectId: "hk-runner",
  storageBucket: "hk-runner.firebasestorage.app",
  messagingSenderId: "488001733626",
  appId: "1:488001733626:web:f1447ea3f8c3909d2a5a43",
  measurementId: "G-HP0GZE2NL5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const db = getFirestore(app);

export { app, analytics, db };
