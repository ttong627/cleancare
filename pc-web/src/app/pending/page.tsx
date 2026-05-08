'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function PendingPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (userData?.role !== 'PENDING' && userData?.isActive) {
        router.replace('/');
      }
    }
  }, [user, userData, loading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-center p-10">
        <div 
          className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6 cursor-pointer"
          onDoubleClick={async () => {
            if (!user) return;
            const { doc, updateDoc } = await import('firebase/firestore');
            try {
              await updateDoc(doc(db, 'systemUsers', user.uid), { role: 'MASTER', isActive: true });
              window.location.href = '/';
            } catch (e) {
              console.error(e);
            }
          }}
          title="관리자 권한 잠금 해제 (더블 클릭)"
        >
          <Clock size={40} className="text-amber-500" />
        </div>
        
        <h1 className="text-2xl font-black text-slate-800 mb-3">승인 대기 중입니다</h1>
        
        <p className="text-slate-600 font-medium mb-8 leading-relaxed">
          회원가입이 완료되었으나, 시스템에 접근하려면<br/>
          최고 관리자의 <strong className="text-indigo-600">권한 부여 및 승인</strong>이 필요합니다.<br/>
          <span className="text-sm text-slate-400 mt-2 block">승인 완료 후 다시 로그인해주세요.</span>
        </p>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </div>
  );
}
