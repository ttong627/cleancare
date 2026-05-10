'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { auth, db } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Key, Save, Loader2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, userData, loading } = useAuth();
  
  const [name, setName] = useState(userData?.name || '');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  if (loading || !user || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // userData 로드 후 state 초기화 (최초 1회)
  if (!name && userData.name) setName(userData.name);
  if (!phone && userData.phone) setPhone(userData.phone);

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('이름을 입력해주세요.');

    setIsSavingInfo(true);
    try {
      await updateDoc(doc(db, 'systemUsers', user.uid), {
        name: name.trim(),
        phone: phone.trim(),
      });
      toast.success('기본 정보가 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('정보 수정에 실패했습니다.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return toast.error('모든 항목을 입력해주세요.');
    if (newPassword !== confirmPassword) return toast.error('새 비밀번호가 일치하지 않습니다.');
    if (newPassword.length < 6) return toast.error('비밀번호는 최소 6자리 이상이어야 합니다.');

    setIsSavingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast.success('비밀번호가 성공적으로 변경되었습니다.');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('보안을 위해 로그아웃 후 다시 로그인해야 비밀번호를 변경할 수 있습니다.', { duration: 5000 });
      } else {
        toast.error('비밀번호 변경에 실패했습니다.');
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="p-8 min-h-screen flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-3 mb-2">
            <User className="text-blue-500" size={32} />
            계정 관리
          </h1>
          <p className="text-slate-500">기본 정보 수정 및 비밀번호 변경을 진행할 수 있습니다.</p>
        </header>

        <div className="space-y-6">
          {/* 기본 정보 수정 */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <User size={20} className="text-blue-500" />
              기본 정보 설정
            </h2>
            <form onSubmit={handleUpdateInfo} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">이메일 계정</label>
                  <input 
                    type="email" 
                    value={userData.email} 
                    disabled 
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed font-medium"
                  />
                  <p className="text-xs text-slate-400 mt-1 ml-1">이메일은 변경할 수 없습니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">권한 그룹</label>
                  <input 
                    type="text" 
                    value={userData.role === 'MASTER' ? '최고 관리자' : userData.role === 'ADMIN' ? '일반 관리자' : '현장 작업자'} 
                    disabled 
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">이름</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">연락처</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isSavingInfo}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                >
                  {isSavingInfo ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  기본 정보 저장
                </button>
              </div>
            </form>
          </div>

          {/* 비밀번호 변경 */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Key size={20} className="text-indigo-500" />
              비밀번호 변경
            </h2>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 leading-relaxed font-medium">
                보안을 위해 비밀번호 변경 전 다시 한 번 확인해주세요.<br/>
                만약 마지막으로 로그인한 지 오래되었다면 보안 정책에 의해 변경이 제한될 수 있으며, 이 경우 <strong className="font-bold">로그아웃 후 다시 로그인</strong> 하시면 정상 변경됩니다.
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">새 비밀번호</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새로운 비밀번호 (6자리 이상)"
                  className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">새 비밀번호 확인</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새로운 비밀번호 확인"
                  className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isSavingPassword}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  {isSavingPassword ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
                  비밀번호 변경
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
