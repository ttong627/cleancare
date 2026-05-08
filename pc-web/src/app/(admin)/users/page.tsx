'use client';

import { useState, useEffect } from 'react';
import { UserCog, UserPlus, Trash2, Shield, Briefcase, Users, Search, X, Save, Loader2, Mail, Phone } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

type UserRole = 'MASTER' | 'ADMIN' | 'WORKER';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: number;
}

const ROLE_CONFIG: Record<UserRole, { label: string; description: string; badge: string; icon: React.ReactNode }> = {
  MASTER: {
    label: '관리자',
    description: '모든 시스템 권한 보유',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: <Shield size={12} />,
  },
  ADMIN: {
    label: '사무실무자',
    description: '정산·발행·조회 가능',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: <Briefcase size={12} />,
  },
  WORKER: {
    label: '현장작업자',
    description: '본인 현장만 조회·수정',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: <Users size={12} />,
  },
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  MASTER: ['모든 데이터 조회/수정/삭제', '사용자 권한 관리', '시스템 설정 변경', '세금계산서 발행·취소', 'DB 백업 및 복원'],
  ADMIN: ['전체 현장 조회', '정산 등록 및 계산서 발행', '작업자·거래처 관리', '팩스 전송', '보고서 출력'],
  WORKER: ['본인 배정 현장만 조회', '완료 보고 및 사진 업로드', 'GPS 위치 실시간 공유', '반려 요청 전송'],
};

const EMPTY_FORM = { name: '', email: '', phone: '', role: 'WORKER' as UserRole };

export default function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const q = query(collection(db, 'systemUsers'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        await seedUsersData();
        return;
      }
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemUser)));
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsubscribe();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('이름과 이메일은 필수입니다.');
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'systemUsers'), {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        isActive: true,
        createdAt: Date.now(),
      });
      toast.success(`${form.name} 사용자가 등록되었습니다.`);
      setForm(EMPTY_FORM);
      setIsModalOpen(false);
    } catch {
      toast.error('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (user: SystemUser) => {
    if (!confirm(`${user.name} 사용자를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'systemUsers', user.id));
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제 실패');
    }
  };

  const handleToggleActive = async (user: SystemUser) => {
    try {
      await updateDoc(doc(db, 'systemUsers', user.id), { isActive: !user.isActive });
      toast.success(user.isActive ? `${user.name} 계정 비활성화` : `${user.name} 계정 활성화`);
    } catch {
      toast.error('상태 변경 실패');
    }
  };

  const handleRoleChange = async (user: SystemUser, newRole: UserRole) => {
    if (user.role === newRole) return;
    try {
      await updateDoc(doc(db, 'systemUsers', user.id), { role: newRole });
      toast.success(`${user.name}의 권한이 ${ROLE_CONFIG[newRole].label}로 변경되었습니다.`);
    } catch {
      toast.error('권한 변경 실패');
    }
  };

  const filtered = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <UserCog className="text-blue-500" size={32} />
            사용자 및 권한 관리
          </h1>
          <p className="text-slate-400">시스템 접근 계정을 관리하고 역할(RBAC)에 따른 세분화된 권한을 제어합니다.</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-colors"
        >
          <UserPlus size={18} /> 신규 사용자 등록
        </button>
      </header>

      {/* 통계 위젯 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '전체 사용자',   value: users.length,                                         color: 'text-white' },
          { label: '관리자',        value: users.filter(u => u.role === 'MASTER').length,        color: 'text-red-400' },
          { label: '사무실무자',    value: users.filter(u => u.role === 'ADMIN').length,         color: 'text-blue-400' },
          { label: '현장작업자',    value: users.filter(u => u.role === 'WORKER').length,        color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
            <p className="text-slate-400 font-medium mb-1">{s.label}</p>
            <h3 className={`text-3xl font-bold ${s.color}`}>{isLoading ? '-' : s.value}명</h3>
          </div>
        ))}
      </div>

      {/* 권한별 설명 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => (
          <div key={role} className="p-5 bg-slate-800/30 border border-slate-700 rounded-xl">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold mb-3 ${cfg.badge}`}>
              {cfg.icon} {cfg.label}
            </span>
            <ul className="space-y-1.5">
              {ROLE_PERMISSIONS[role].map((perm, i) => (
                <li key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-500 shrink-0" />
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 검색 + 역할 필터 */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="이름 또는 이메일 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
          {([['ALL', '전체'], ['MASTER', '관리자'], ['ADMIN', '사무실무자'], ['WORKER', '현장작업자']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRoleFilter(val)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${roleFilter === val ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 사용자 테이블 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="p-4 text-slate-300 font-semibold">사용자</th>
              <th className="p-4 text-slate-300 font-semibold">이메일 / 연락처</th>
              <th className="p-4 text-slate-300 font-semibold">현재 권한</th>
              <th className="p-4 text-slate-300 font-semibold">권한 변경</th>
              <th className="p-4 text-slate-300 font-semibold">계정 상태</th>
              <th className="p-4 text-slate-300 font-semibold text-center">삭제</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3].map(i => (
                <tr key={i}>
                  <td colSpan={6} className="p-0">
                    <div className="h-16 mx-4 my-2 bg-slate-800/40 rounded-xl animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500">
                  {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다.` : '등록된 사용자가 없습니다.'}
                </td>
              </tr>
            ) : filtered.map(user => {
              const cfg = ROLE_CONFIG[user.role];
              return (
                <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold ${user.isActive ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-600'}`}>
                        {user.name[0]}
                      </div>
                      <span className={`font-medium ${user.isActive ? 'text-white' : 'text-slate-500 line-through'}`}>{user.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-300 mb-0.5">
                      <Mail size={12} className="text-slate-500" />
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone size={11} className="text-slate-600" />
                        {user.phone}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${cfg.badge}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user, e.target.value as UserRole)}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="MASTER">관리자</option>
                      <option value="ADMIN">사무실무자</option>
                      <option value="WORKER">현장작업자</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        user.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                          : 'bg-slate-700/50 text-slate-500 border-slate-600 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                      }`}
                    >
                      {user.isActive ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-400/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 신규 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="text-blue-400" size={22} /> 신규 사용자 등록
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">이름 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Phone size={13} /> 연락처</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1"><Mail size={13} /> 이메일 <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="user@cleancare.co.kr"
                  required
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">시스템 권한 <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => (
                    <label
                      key={role}
                      className={`flex flex-col gap-1.5 p-3 border rounded-xl cursor-pointer transition-all ${
                        form.role === role
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <input type="radio" name="role" checked={form.role === role} onChange={() => setForm({ ...form, role })} className="hidden" />
                      <span className="font-bold text-sm">{cfg.label}</span>
                      <span className="text-xs opacity-70">{cfg.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-slate-300 bg-slate-800 border border-slate-600 rounded-xl hover:bg-slate-700 transition-colors">취소</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

async function seedUsersData() {
  const snapshot = await getDocs(collection(db, 'systemUsers'));
  if (!snapshot.empty) return;
  const mock = [
    { name: '김대표', email: 'master@cleancare.co.kr', phone: '010-1111-0001', role: 'MASTER', isActive: true },
    { name: '이사무', email: 'admin@cleancare.co.kr',  phone: '010-2222-0002', role: 'ADMIN',  isActive: true },
    { name: '박사무', email: 'office@cleancare.co.kr', phone: '010-3333-0003', role: 'ADMIN',  isActive: true },
    { name: '김철수', email: 'worker1@cleancare.co.kr',phone: '010-4444-0004', role: 'WORKER', isActive: true },
    { name: '이영희', email: 'worker2@cleancare.co.kr',phone: '010-5555-0005', role: 'WORKER', isActive: false },
  ];
  for (const u of mock) {
    await addDoc(collection(db, 'systemUsers'), { ...u, createdAt: Date.now() });
  }
}
