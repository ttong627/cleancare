import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDwcjhD8ZT28cy-kk2dPoKC5zDCWHAhyPI",
  authDomain: "cleancare-cf307.firebaseapp.com",
  projectId: "cleancare-cf307",
  storageBucket: "cleancare-cf307.firebasestorage.app",
  messagingSenderId: "545863599367",
  appId: "1:545863599367:web:68d1f6050293258217f1a2",
  measurementId: "G-XLT5YGZXMK"
};

// 중복 초기화 방지 및 무지연 싱글톤 패턴 적용
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
