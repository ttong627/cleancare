'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('관리자 시스템에 로그인되었습니다.');
      router.push('/');
    } catch (error: any) {
      console.error(error);
      const errorCode = error.code;
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        toast.error('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else if (errorCode === 'auth/invalid-email') {
        toast.error('유효하지 않은 이메일 형식입니다.');
      } else {
        toast.error('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}>
      {/* 장식용 배경 요소 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white opacity-10 blur-3xl mix-blend-overlay"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300 opacity-20 blur-3xl mix-blend-overlay"></div>
      </div>

      <div className="w-full max-w-[420px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/40">
        <div className="p-10 flex flex-col items-center">
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={32} className="text-white" />
          </div>
          
          <h1 className="text-2xl font-black text-slate-800 mb-2">클린케어 관리자 로그인</h1>
          <p className="text-sm font-medium text-slate-500 mb-8 text-center">
            허가된 관리자만 접근할 수 있는 시스템입니다.<br/>
            부여받은 계정 정보를 입력해주세요.
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">이메일 주소</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cleancare.com"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  로그인 중...
                </>
              ) : (
                '시스템 접속하기'
              )}
            </button>
          </form>

        </div>
        
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-400 font-medium">
            로그인에 문제가 있으신가요? 시스템 관리자에게 문의하세요.
          </p>
          <div className="w-12 h-px bg-slate-200 my-1"></div>
          <p className="text-sm text-slate-600 font-medium">
            처음 오셨나요?{' '}
            <Link href="/signup" className="text-blue-600 font-bold hover:text-blue-800 transition-colors">
              계정 만들기 (회원가입)
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
