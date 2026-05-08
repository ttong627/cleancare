'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Receipt, CheckSquare, Square, Search, Send, Building2, X,
  Trash2, PencilLine, FileText, Clock, ChevronRight, Loader2
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProjectData } from '@/hooks/useProjects';
import { Invoice } from '@/schema';
import toast from 'react-hot-toast';

import ClientManagerModal from '@/components/ClientManagerModal';
import InvoiceIssueModal from '@/components/InvoiceIssueModal';

type Tab = 'PENDING' | 'ISSUED';

export default function SettlementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('PENDING');

  // 발행 대기 탭 state
  const [completedProjects, setCompletedProjects] = useState<ProjectData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 발행 완료 탭 state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // 모달 state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // 금액 등록 모달 state
  const [priceModal, setPriceModal] = useState<{ project: ProjectData; value: string } | null>(null);
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // 완료된 프로젝트 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'projects'), where('status', '==', 'COMPLETED'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCompletedProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectData)));
      setIsLoadingProjects(false);
    });
    return () => unsubscribe();
  }, []);

  // 발행된 계산서 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('issuedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      setIsLoadingInvoices(false);
    }, () => setIsLoadingInvoices(false));
    return () => unsubscribe();
  }, []);

  // 발행 대기 목록 (미발행만)
  const pendingProjects = useMemo(() => {
    const list = completedProjects.filter(p => !p.invoiceIssued);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p => p.name.toLowerCase().includes(q) || (p.workerName ?? '').toLowerCase().includes(q));
  }, [completedProjects, searchQuery]);

  // 발행 완료 계산서 필터
  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return invoices;
    const q = invoiceSearch.toLowerCase();
    return invoices.filter(inv =>
      inv.clientName.toLowerCase().includes(q) ||
      inv.itemName.toLowerCase().includes(q) ||
      inv.managerName.toLowerCase().includes(q)
    );
  }, [invoices, invoiceSearch]);

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const toggleSelectAll = () => {
    const all = pendingProjects.every(p => selectedIds.has(p.id));
    setSelectedIds(all ? new Set() : new Set(pendingProjects.map(p => p.id)));
  };

  const handleBulkIssue = () => {
    if (selectedIds.size === 0) { toast.error('발행할 항목을 선택해주세요.'); return; }
    setIsInvoiceModalOpen(true);
  };

  const handleDeleteProject = async (project: ProjectData) => {
    if (!confirm(`"${project.name}" 정산 항목을 삭제하시겠습니까?\n\n⚠️ 프로젝트 자체는 유지되지만 정산 금액이 초기화됩니다.`)) return;
    try {
      await updateDoc(doc(db, 'projects', project.id), { price: null, invoiceIssued: false });
      toast.success('정산 정보가 초기화되었습니다.');
    } catch {
      toast.error('삭제 실패');
    }
  };

  const handleSavePrice = async () => {
    if (!priceModal) return;
    const price = Number(priceModal.value.replace(/,/g, ''));
    if (isNaN(price) || price < 0) { toast.error('올바른 금액을 입력해주세요.'); return; }
    setIsSavingPrice(true);
    try {
      await updateDoc(doc(db, 'projects', priceModal.project.id), { price });
      toast.success('정산 금액이 등록되었습니다.');
      setPriceModal(null);
    } catch {
      toast.error('저장 실패');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const totalSelected = completedProjects
    .filter(p => selectedIds.has(p.id))
    .reduce((s, p) => s + (p.price ?? 0), 0);

  const selectedProjectsData = completedProjects
    .filter(p => selectedIds.has(p.id))
    .map(p => ({ id: p.id, name: p.name, price: p.price ?? 0 }));

  // 이번달 발행액
  const thisMonthIssued = useMemo(() => {
    const now = new Date();
    return invoices
      .filter(inv => {
        const d = new Date(inv.issuedAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, inv) => s + inv.amount, 0);
  }, [invoices]);

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Receipt className="text-blue-500" size={32} />
            정산 및 전자세금계산서 관리
          </h1>
          <p className="text-slate-400">완료 현장의 정산을 등록하고 국세청 연동 세금계산서를 발행합니다.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsClientModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
          >
            <Building2 size={18} /> 거래처 관리
          </button>
          {activeTab === 'PENDING' && (
            <button
              onClick={handleBulkIssue}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-colors"
            >
              <Send size={18} /> 선택 발행 ({selectedIds.size}건)
            </button>
          )}
        </div>
      </header>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
          <p className="text-slate-400 font-medium mb-1">발행 대기 현장</p>
          <h3 className="text-3xl font-bold text-white">{completedProjects.filter(p => !p.invoiceIssued).length}건</h3>
        </div>
        <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <p className="text-blue-400 font-medium mb-1">선택된 정산액 (예상)</p>
          <h3 className="text-3xl font-bold text-white">{totalSelected.toLocaleString()}원</h3>
        </div>
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <p className="text-emerald-400 font-medium mb-1">이번 달 총 발행액</p>
          <h3 className="text-3xl font-bold text-white">{thisMonthIssued.toLocaleString()}원</h3>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'PENDING' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock size={16} />
          발행 대기
          {completedProjects.filter(p => !p.invoiceIssued).length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full border border-amber-500/30">
              {completedProjects.filter(p => !p.invoiceIssued).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('ISSUED')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'ISSUED' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText size={16} />
          발행 완료 내역
          {invoices.length > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
              {invoices.length}
            </span>
          )}
        </button>
      </div>

      {/* ── 발행 대기 탭 ── */}
      {activeTab === 'PENDING' && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="현장명, 작업자명 검색..."
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

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700">
                  <th className="p-4 w-14 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                      {pendingProjects.length > 0 && pendingProjects.every(p => selectedIds.has(p.id))
                        ? <CheckSquare size={20} className="text-emerald-500" />
                        : <Square size={20} />
                      }
                    </button>
                  </th>
                  <th className="p-4 text-slate-300 font-semibold">현장명</th>
                  <th className="p-4 text-slate-300 font-semibold">담당 작업자</th>
                  <th className="p-4 text-slate-300 font-semibold">청구 금액 (VAT 별도)</th>
                  <th className="p-4 text-slate-300 font-semibold">완료일</th>
                  <th className="p-4 text-slate-300 font-semibold text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingProjects ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">불러오는 중...</td></tr>
                ) : pendingProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500">
                      {searchQuery ? '검색 결과가 없습니다.' : '발행 대기 중인 완료 현장이 없습니다.'}
                    </td>
                  </tr>
                ) : pendingProjects.map(project => (
                  <tr key={project.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors group">
                    <td className="p-4 text-center">
                      <button onClick={() => toggleSelect(project.id)} className="text-slate-500 group-hover:text-slate-300">
                        {selectedIds.has(project.id)
                          ? <CheckSquare size={20} className="text-emerald-500" />
                          : <Square size={20} />
                        }
                      </button>
                    </td>
                    <td className="p-4 font-medium text-white">{project.name}</td>
                    <td className="p-4 text-slate-400">{project.workerName}</td>
                    <td className="p-4">
                      {project.price != null ? (
                        <span className="font-semibold text-blue-400">{project.price.toLocaleString()} 원</span>
                      ) : (
                        <span className="text-amber-500 text-sm font-medium">금액 미입력</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-sm">
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setPriceModal({ project, value: project.price?.toString() ?? '' })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                          title="정산 금액 등록/수정"
                        >
                          <PencilLine size={13} /> 정산 등록
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project)}
                          className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="정산 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 발행 완료 내역 탭 ── */}
      {activeTab === 'ISSUED' && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="거래처명, 품명, 담당자 검색..."
              value={invoiceSearch}
              onChange={e => setInvoiceSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-blue-500 transition-all"
            />
            {invoiceSearch && (
              <button onClick={() => setInvoiceSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700">
                  <th className="p-4 text-slate-300 font-semibold">발행일시</th>
                  <th className="p-4 text-slate-300 font-semibold">품명</th>
                  <th className="p-4 text-slate-300 font-semibold">거래처 (사업자번호)</th>
                  <th className="p-4 text-slate-300 font-semibold">담당자 수신처</th>
                  <th className="p-4 text-slate-300 font-semibold">발행 금액</th>
                  <th className="p-4 text-slate-300 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingInvoices ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">불러오는 중...</td></tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500">
                      {invoiceSearch ? '검색 결과가 없습니다.' : '발행된 세금계산서가 없습니다.'}
                    </td>
                  </tr>
                ) : filteredInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-800 hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 text-slate-400 text-sm">
                      {new Date(inv.issuedAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="p-4 font-medium text-white">{inv.itemName}</td>
                    <td className="p-4">
                      <p className="text-slate-300 font-medium">{inv.clientName}</p>
                      <p className="text-slate-500 text-xs font-mono">{inv.businessNumber}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-slate-300 text-sm">{inv.managerName}</p>
                      <p className="text-slate-500 text-xs">{inv.managerEmail}</p>
                    </td>
                    <td className="p-4 font-bold text-emerald-400">
                      {inv.amount.toLocaleString()} 원
                    </td>
                    <td className="p-4">
                      {inv.status === 'ISSUED' ? (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                          발행 완료
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-bold">
                          취소됨
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 정산 금액 등록 모달 */}
      {priceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PencilLine className="text-blue-400" size={20} /> 정산 금액 등록
              </h2>
              <button onClick={() => setPriceModal(null)} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                <span className="text-white font-medium">{priceModal.project.name}</span> 현장의 정산 금액을 입력하세요.
              </p>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">청구 금액 (VAT 별도)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={priceModal.value}
                    onChange={e => setPriceModal({ ...priceModal, value: e.target.value })}
                    placeholder="0"
                    min={0}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-right text-lg font-bold pr-10"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSavePrice(); }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">원</span>
                </div>
                {priceModal.value && (
                  <p className="text-right text-xs text-slate-500 mt-1.5">
                    {Number(priceModal.value).toLocaleString()} 원
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setPriceModal(null)} className="flex-1 py-3 font-bold text-slate-300 bg-slate-800 border border-slate-600 rounded-xl hover:bg-slate-700 transition-colors">
                  취소
                </button>
                <button onClick={handleSavePrice} disabled={isSavingPrice} className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSavingPrice ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ClientManagerModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} />

      <InvoiceIssueModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        selectedProjects={selectedProjectsData}
        onSuccess={() => { setIsInvoiceModalOpen(false); setSelectedIds(new Set()); setActiveTab('ISSUED'); }}
      />
    </div>
  );
}
