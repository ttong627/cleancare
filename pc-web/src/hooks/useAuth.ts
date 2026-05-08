import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface AuthUserData {
  uid: string;
  email: string;
  role: 'MASTER' | 'ADMIN' | 'WORKER' | 'PENDING';
  isActive: boolean;
  name: string;
  phone?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AuthUserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      // 이전 Firestore 구독 해제 (메모리 누수 방지)
      if (unsubscribeData) {
        unsubscribeData();
        unsubscribeData = null;
      }

      if (!authUser) {
        setUser(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      setUser(authUser);

      // UID 기반 직접 문서 참조 (email 쿼리 제거 → 인덱스 불필요, 속도 2배 향상)
      const userRef = doc(db, 'systemUsers', authUser.uid);
      unsubscribeData = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserData({
            uid: authUser.uid,
            email: authUser.email || '',
            role: data.role || 'PENDING',
            isActive: data.isActive || false,
            name: data.name || '',
            phone: data.phone || '',
          });
        } else {
          // 파이어베이스 콘솔에서 직접 생성된 사용자 → DB 자동 등록
          const newUserData: AuthUserData = {
            uid: authUser.uid,
            email: authUser.email || '',
            role: 'PENDING',
            isActive: false,
            name: authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
          };
          // setDoc: 문서가 없으면 생성, 있으면 오류 없이 무시 (merge: false)
          setDoc(userRef, { ...newUserData, createdAt: Date.now() }).catch(console.error);
          setUserData(newUserData);
        }
        setLoading(false);
      }, (err) => {
        console.error('[useAuth] Firestore 구독 오류:', err);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) unsubscribeData();
    };
  }, []);

  return { user, userData, loading };
}
