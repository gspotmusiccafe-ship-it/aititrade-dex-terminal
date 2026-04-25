import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration from the Console
const firebaseConfig = {
  apiKey: "AIzaSyBJ4ZfwXUGFMLAwBIQ1xzZUHwA7v6C5w6A",
  authDomain: "aititrade-exchange-pro.firebaseapp.com",
  projectId: "aititrade-exchange-pro",
  storageBucket: "aititrade-exchange-pro.firebasestorage.app",
  messagingSenderId: "716758817403",
  appId: "1:716758817403:web:84fd7b27d98c5a2dcae0de",
  measurementId: "G-LZ57JN8RJ0"
};

// Initialize Firebase for the Global Floor
export const app = initializeApp(firebaseConfig);

// Initialize Analytics for Market Intel
if (typeof window !== "undefined") {
  getAnalytics(app);
}
