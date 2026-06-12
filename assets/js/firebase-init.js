import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXTg6ceEoRLC1-MmYNZp6PIkKRjI7L4iI",
  authDomain: "jdk-member-board.firebaseapp.com",
  projectId: "jdk-member-board",
  storageBucket: "jdk-member-board.firebasestorage.app",
  messagingSenderId: "123182148308",
  appId: "1:123182148308:web:a6b39240421b493aace941"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
