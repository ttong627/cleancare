'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { UserPlus, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !passwordConfirm) {
      toast.error('모든 항목을 입력해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      toast.error('비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save to systemUsers collection
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'systemUsers', userCredential.user.uid), {
        name: email.split('@')[0], // 기본 이름 (이메일 앞부분)
        email: email,
        role: 'PENDING',
        isActive: false,
        createdAt: Date.now()
      });

      toast.success('회원가입이 완료되었습니다! 관리자 승인 대기 화면으로 이동합니다.');
      router.push('/pending');
    } catch (error: any) {
      console.error(error);
      const errorCode = error.code;
      if (errorCode === 'auth/email-already-in-use') {
        toast.error('이미 가입된 이메일입니다.');
      } else if (errorCode === 'auth/invalid-email') {
        toast.error('유효하지 않은 이메일 형식입니다.');
      } else {
        toast.error('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}>
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white opacity-10 blur-3xl mix-blend-overlay"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300 opacity-20 blur-3xl mix-blend-overlay"></div>
      </div>

      <div className="w-full max-w-[420px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/40">
        <div className="p-10 flex flex-col items-center">
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
            <UserPlus size={32} className="text-white" />
          </div>
          
          <h1 className="text-2xl font-black text-slate-800 mb-2">관리자/사용자 회원가입</h1>
          <p className="text-sm font-medium text-slate-500 mb-8 text-center">
            클린케어 시스템에 접속할 계정을 생성합니다.
          </p>

          <form onSubmit={handleSignup} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">사용할 이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@cleancare.com"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">비밀번호 (6자리 이상)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  가입 처리 중...
                </>
              ) : (
                '계정 생성 및 로그인'
              )}
            </button>
          </form>

        </div>
        
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <Link href="/login" className="text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center justify-center gap-1 transition-colors">
            <ArrowLeft size={16} />
            이미 계정이 있으신가요? 로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}
