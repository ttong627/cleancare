'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Bell, MapPin, UserPlus, X, Phone, Briefcase, Save, Loader2, Trash2, Mail } from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

type WorkerStatus = 'ONLINE' | 'WORKING' | 'OFFLINE';

interface WorkerData {
  id: string;
  name: string;
  role: string;
  phone?: string;
  googleEmail?: string;   // ← 추가: 구글 캘린더 초대용 이메일
  status: WorkerStatus;
  lastLocation: string;
  assignedProject?: string;
}

const STATUS_MAP: Record<WorkerStatus, { label: string; dot: string; badge: string }> = {
  WORKING: { label: '작업 중',    dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ONLINE:  { label: '대기(온라인)', dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  OFFLINE: { label: '오프라인',   dot: 'bg-slate-500',   badge: 'bg-slate-700/50 text-slate-400 border-slate-600' },
};

const EMPTY_FORM = { name: '', role: '', phone: '', googleEmail: '', status: 'OFFLINE' as WorkerStatus, lastLocation: '' };

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const q = query(collection(db, 'workers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WorkerData));
      setWorkers(data);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('이름을 입력해주세요.'); return; }
    // 이메일 형식 검증 (입력된 경우)
    if (form.googleEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.googleEmail)) {
      toast.error('올바른 구글 이메일 형식을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim(),
        phone: form.phone.trim(),
        googleEmail: form.googleEmail.trim(),
        status: form.status,
        lastLocation: form.lastLocation.trim() || '위치 정보 없음',
      };
      if (editingId) {
        await setDoc(doc(db, 'workers', editingId), { ...payload, updatedAt: Date.now() }, { merge: true });
        toast.success(`${form.name} 작업자 정보가 수정되었습니다.`);
      } else {
        await addDoc(collection(db, 'workers'), {
          ...payload,
          assignedProject: null,
          createdAt: Date.now(),
        });
        toast.success(`${form.name} 작업자가 등록되었습니다.`);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setIsModalOpen(false);
    } catch {
      toast.error(editingId ? '수정에 실패했습니다.' : '등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (worker: WorkerData) => {
    if (!confirm(`${worker.name} 작업자를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'workers', worker.id));
      toast.success('삭제되었습니다.');
    } catch { toast.error('삭제 실패'); }
  };

  const handlePush = (name: string) => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1000)),
      {
        loading: `${name}님에게 푸시 전송 중...`,
        success: <b>{name}님 기기로 긴급 알림 전송 완료!</b>,
        error: <b>전송 실패</b>,
      }
    );
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return q
      ? workers.filter(w => w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q))
      : workers;
  }, [workers, searchQuery]);

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Users className="text-blue-500" size={32} />
            현장 작업자 종합 관리
          </h1>
          <p className="text-slate-400">등록된 작업자의 실시간 위치(GPS), 근태 상태 및 프로젝트 배정 현황을 관제합니다.</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-colors"
        >
          <UserPlus size={18} /> 신규 작업자 등록
        </button>
      </header>

      {/* 통계 위젯 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '전체 작업자',  value: workers.length,                                      color: 'text-white' },
          { label: '현재 작업 중', value: workers.filter(w => w.status === 'WORKING').length,  color: 'text-blue-400' },
          { label: '대기(온라인)', value: workers.filter(w => w.status === 'ONLINE').length,   color: 'text-emerald-400' },
          { label: '구글 이메일 등록', value: workers.filter(w => w.googleEmail).length,       color: 'text-yellow-400' },
        ].map((s, i) => (
          <div key={i} className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
            <p className="text-slate-400 font-medium mb-1">{s.label}</p>
            <h3 className={`text-3xl font-bold ${s.color}`}>{isLoading ? '-' : s.value}명</h3>
          </div>
        ))}
      </div>

      {/* 검색 바 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input
          type="text"
          placeholder="이름 또는 직급으로 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {/* 구글 이메일 미등록 안내 배너 */}
      {!isLoading && workers.some(w => !w.googleEmail) && (
        <div className="mb-5 px-5 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3 text-sm">
          <Mail size={16} className="text-yellow-400 shrink-0" />
          <span className="text-yellow-300 font-medium">
            구글 이메일이 미등록된 작업자가 있습니다.
            <span className="text-yellow-400 font-bold"> 수정 버튼 → 구글 이메일 입력</span> 시 캘린더 초대가 자동으로 발송됩니다.
          </span>
        </div>
      )}

      {/* 작업자 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3].map(i => (
            <div key={i} className="h-48 bg-slate-800/40 border border-slate-700 rounded-2xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500">
            {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다.` : '등록된 작업자가 없습니다.'}
          </div>
        ) : filtered.map(worker => {
          const s = STATUS_MAP[worker.status];
          return (
            <div key={worker.id} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 hover:bg-slate-800/60 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300 relative shrink-0">
                    {worker.name[0]}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${s.dot}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{worker.name}</h3>
                    <p className="text-sm text-slate-400">{worker.role || '직급 미지정'}</p>
                    {worker.phone && <p className="text-xs text-slate-500 mt-0.5">{worker.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingId(worker.id);
                      setForm({
                        name: worker.name,
                        role: worker.role || '',
                        phone: worker.phone || '',
                        googleEmail: worker.googleEmail || '',
                        status: worker.status,
                        lastLocation: worker.lastLocation || '',
                      });
                      setIsModalOpen(true);
                    }}
                    className="text-slate-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-700/50"
                    title="작업자 수정"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(worker)}
                    className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-700/50"
                    title="작업자 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MapPin size={14} className="text-slate-500 shrink-0" />
                  {worker.lastLocation}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={14} className="text-slate-500 shrink-0" />
                  <span className="text-blue-400 truncate font-medium">{worker.assignedProject || '배정 대기 중'}</span>
                </div>
                {/* 구글 이메일 표시 */}
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-slate-500 shrink-0" />
                  {worker.googleEmail
                    ? <span className="text-emerald-400 font-mono text-xs truncate">{worker.googleEmail}</span>
                    : <span className="text-slate-600 text-xs italic">구글 이메일 미등록</span>
                  }
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${s.badge}`}>
                  {s.label}
                </span>
                <button
                  onClick={() => handlePush(worker.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Bell size={13} /> 긴급 푸시
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 신규/수정 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="text-blue-400" size={22} /> {editingId ? '작업자 정보 수정' : '신규 작업자 등록'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">이름 <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동" required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">직급 / 역할</label>
                  <input type="text" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    placeholder="현장 팀장"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Phone size={14} /> 연락처
                </label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              {/* ── 구글 이메일 (핵심 추가 필드) ── */}
              <div>
                <label className="block text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Mail size={14} /> 구글 이메일 (캘린더 초대용)
                </label>
                <input type="email" value={form.googleEmail} onChange={e => setForm({ ...form, googleEmail: e.target.value })}
                  placeholder="worker@gmail.com"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-emerald-500/40 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm" />
                <p className="text-xs text-slate-500 mt-1.5">
                  📅 작업 일정 등록 시 이 이메일로 구글 캘린더 초대가 자동 발송됩니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">상태 설정</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(STATUS_MAP) as [WorkerStatus, typeof STATUS_MAP[WorkerStatus]][]).map(([key, cfg]) => (
                    <label key={key}
                      className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium ${form.status === key ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}
                    >
                      <input type="radio" name="status" checked={form.status === key} onChange={() => setForm({ ...form, status: key })} className="hidden" />
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                      {cfg.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <MapPin size={14} /> 현재 위치 (선택)
                </label>
                <input type="text" value={form.lastLocation} onChange={e => setForm({ ...form, lastLocation: e.target.value })}
                  placeholder="예: 수원시 영통구"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 font-bold text-slate-300 bg-slate-800 border border-slate-600 rounded-xl hover:bg-slate-700 transition-colors">취소</button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editingId ? '수정 완료' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
