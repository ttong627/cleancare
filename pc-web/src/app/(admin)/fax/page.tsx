'use client';

import { useState, useEffect } from 'react';
import { Printer, Send, Plus, X, Clock, CheckCircle2, AlertCircle, FileText, Phone, Loader2, Trash2 } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

type FaxStatus = 'PENDING' | 'SENDING' | 'SUCCESS' | 'FAILED';

interface FaxItem {
  id: string;
  recipientName: string;
  recipientFax: string;
  documentName: string;
  requestedBy: string;
  source: 'PC' | 'MOBILE';
  status: FaxStatus;
  createdAt: number;
  sentAt?: number;
  memo?: string;
}

const STATUS_CONFIG: Record<FaxStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: '대기 중',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: <Clock size={14} /> },
  SENDING:  { label: '전송 중',   color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',       icon: <Loader2 size={14} className="animate-spin" /> },
  SUCCESS:  { label: '전송 완료', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle2 size={14} /> },
  FAILED:   { label: '전송 실패', color: 'text-red-400 bg-red-400/10 border-red-400/20',          icon: <AlertCircle size={14} /> },
};

const EMPTY_FORM = { recipientName: '', recipientFax: '', documentName: '', memo: '' };

export default function FaxPage() {
  const [faxList, setFaxList] = useState<FaxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');

  useEffect(() => {
    const q = query(collection(db, 'faxQueue'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FaxItem));
      setFaxList(data);
      setIsLoading(false);
    }, () => {
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const pendingList  = faxList.filter(f => f.status === 'PENDING' || f.status === 'SENDING');
  const historyList  = faxList.filter(f => f.status === 'SUCCESS' || f.status === 'FAILED');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientFax.match(/^\d{2,4}-\d{3,4}-\d{4}$/)) {
      toast.error('팩스 번호 형식을 확인해주세요. (예: 031-123-4567)');
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'faxQueue'), {
        recipientName: form.recipientName,
        recipientFax: form.recipientFax,
        documentName: form.documentName,
        memo: form.memo,
        requestedBy: '관리자 (PC)',
        source: 'PC',
        status: 'PENDING',
        createdAt: Date.now(),
      });
      toast.success('팩스 대기열에 등록되었습니다.');
      setForm(EMPTY_FORM);
      setIsModalOpen(false);
    } catch {
      toast.error('등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async (item: FaxItem) => {
    const ref = doc(db, 'faxQueue', item.id);
    await updateDoc(ref, { status: 'SENDING' });

    toast.promise(
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      {
        loading: `${item.recipientName}(${item.recipientFax})으로 팩스 전송 중...`,
        success: () => {
          updateDoc(ref, { status: 'SUCCESS', sentAt: Date.now() });
          return <b>팩스 전송이 완료되었습니다!</b>;
        },
        error: () => {
          updateDoc(ref, { status: 'FAILED' });
          return <b>팩스 전송에 실패했습니다.</b>;
        },
      }
    );
  };

  const handleBulkSend = async () => {
    if (pendingList.length === 0) {
      toast.error('전송할 대기 항목이 없습니다.');
      return;
    }
    for (const item of pendingList.filter(f => f.status === 'PENDING')) {
      await handleSend(item);
    }
  };

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Printer className="text-teal-500" size={32} />
            관공서 팩스 일괄 전송 (PC/모바일 통합)
          </h1>
          <p className="text-slate-400">현장 작업자가 모바일 앱에서 요청하거나, 관리자가 PC에서 직접 등록·발송하는 통합 팩스 시스템입니다.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition-colors"
          >
            <Plus size={18} /> 신규 팩스 등록
          </button>
          <button
            onClick={handleBulkSend}
            disabled={pendingList.filter(f => f.status === 'PENDING').length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-lg font-medium shadow-lg shadow-teal-500/20 transition-colors"
          >
            <Send size={18} /> 대기 전체 발송 ({pendingList.filter(f => f.status === 'PENDING').length}건)
          </button>
        </div>
      </header>

      {/* 요약 위젯 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '전체',    value: faxList.length,                                       color: 'text-white' },
          { label: '대기 중', value: pendingList.filter(f => f.status === 'PENDING').length,  color: 'text-yellow-400' },
          { label: '전송 완료', value: historyList.filter(f => f.status === 'SUCCESS').length, color: 'text-emerald-400' },
          { label: '전송 실패', value: historyList.filter(f => f.status === 'FAILED').length,  color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="p-5 bg-slate-800/50 border border-slate-700 rounded-2xl">
            <p className="text-slate-400 text-sm font-medium mb-1">{s.label}</p>
            <h3 className={`text-3xl font-bold ${s.color}`}>{isLoading ? '-' : s.value}건</h3>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl w-fit border border-slate-700">
        {(['PENDING', 'HISTORY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {tab === 'PENDING' ? `대기열 (${pendingList.length})` : `발송 이력 (${historyList.length})`}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={36} />
            <p>데이터를 불러오는 중...</p>
          </div>
        ) : (activeTab === 'PENDING' ? pendingList : historyList).length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center gap-4 text-slate-500">
            <Printer size={56} className="text-slate-700" />
            <p className="text-lg font-medium text-slate-400">
              {activeTab === 'PENDING' ? '대기 중인 팩스가 없습니다.' : '발송 이력이 없습니다.'}
            </p>
            {activeTab === 'PENDING' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus size={18} /> 첫 팩스 등록하기
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-700">
                <th className="p-4 text-slate-400 font-semibold">수신처</th>
                <th className="p-4 text-slate-400 font-semibold">팩스 번호</th>
                <th className="p-4 text-slate-400 font-semibold">서류명</th>
                <th className="p-4 text-slate-400 font-semibold">요청자</th>
                <th className="p-4 text-slate-400 font-semibold">등록 시각</th>
                <th className="p-4 text-slate-400 font-semibold">상태</th>
                {activeTab === 'PENDING' && <th className="p-4 w-28"></th>}
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'PENDING' ? pendingList : historyList).map(item => {
                const cfg = STATUS_CONFIG[item.status];
                return (
                  <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-medium text-white">{item.recipientName}</td>
                    <td className="p-4 text-slate-300 font-mono">{item.recipientFax}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-2 text-slate-300">
                        <FileText size={14} className="text-slate-500 shrink-0" />
                        {item.documentName}
                      </span>
                      {item.memo && <p className="text-xs text-slate-500 mt-1 pl-5">{item.memo}</p>}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded font-bold ${item.source === 'MOBILE' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                        {item.source === 'MOBILE' ? '📱 모바일' : '🖥 PC'}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">{item.requestedBy}</p>
                    </td>
                    <td className="p-4 text-slate-500 text-sm">
                      {new Date(item.createdAt).toLocaleString('ko-KR')}
                      {item.sentAt && (
                        <p className="text-xs text-emerald-500 mt-1">
                          완료: {new Date(item.sentAt).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full border text-xs font-bold ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    {activeTab === 'PENDING' && (
                      <td className="p-4">
                        <button
                          onClick={() => handleSend(item)}
                          disabled={item.status === 'SENDING'}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-sm rounded-lg font-bold transition-colors flex items-center gap-1.5"
                        >
                          <Send size={14} /> 전송
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 신규 팩스 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Printer className="text-teal-500" /> 신규 팩스 등록
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">수신처명 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.recipientName}
                  onChange={e => setForm({ ...form, recipientName: e.target.value })}
                  placeholder="예: 수원교육지원청 시설과"
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                  <Phone size={14} /> 수신 팩스 번호 <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={form.recipientFax}
                  onChange={e => setForm({ ...form, recipientFax: e.target.value })}
                  placeholder="031-123-4567"
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">형식: 지역번호-국번-번호 (예: 031-123-4567)</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                  <FileText size={14} /> 서류명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.documentName}
                  onChange={e => setForm({ ...form, documentName: e.target.value })}
                  placeholder="예: 수원 광교중학교 에어컨 세척 완료 보고서"
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">비고 (선택)</label>
                <textarea
                  value={form.memo}
                  onChange={e => setForm({ ...form, memo: e.target.value })}
                  placeholder="수신 담당자명, 특이사항 등"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 font-bold text-slate-300 bg-slate-800 border border-slate-600 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-500 shadow-lg shadow-teal-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  대기열 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
