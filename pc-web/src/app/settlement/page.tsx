'use client';

import { useState, useEffect } from 'react';
import { Receipt, CheckSquare, Square, Search, Filter, Send, Download, Building2 } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProjectData } from '@/hooks/useProjects';
import toast from 'react-hot-toast';

import ClientManagerModal from '@/components/ClientManagerModal';
import InvoiceIssueModal from '@/components/InvoiceIssueModal';

export default function SettlementPage() {
  const [completedProjects, setCompletedProjects] = useState<ProjectData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // 모달 상태
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  useEffect(() => {
    // 완료된(COMPLETED) 현장 중 세금계산서 미발행건 위주로
    const q = query(collection(db, 'projects'), where('status', '==', 'COMPLETED'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProjectData));
      
      // 임의의 정산 금액(Price) 추가 로직 (실제로는 DB에 있어야 함)
      const dataWithPrice = data.map(item => ({
        ...item,
        price: item.price || Math.floor(Math.random() * 5 + 3) * 100000 // 30만~80만 원 랜덤 배정
      }));

      setCompletedProjects(dataWithPrice);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleSelectAll = () => {
    const unissuedProjects = completedProjects.filter(p => !p.invoiceIssued);
    if (selectedIds.size === unissuedProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unissuedProjects.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string, invoiceIssued: boolean) => {
    if (invoiceIssued) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkIssue = () => {
    if (selectedIds.size === 0) {
      toast.error('발행할 항목을 선택해주세요.');
      return;
    }
    setIsInvoiceModalOpen(true);
  };

  const totalAmount = completedProjects
    .filter(p => selectedIds.has(p.id))
    .reduce((sum, p) => sum + (p as ProjectData & { price: number }).price, 0);

  const selectedProjectsData = completedProjects
    .filter(p => selectedIds.has(p.id))
    .map(p => ({ id: p.id, name: p.name, price: (p as any).price }));

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Receipt className="text-blue-500" size={32} />
            정산 및 전자세금계산서 관리
          </h1>
          <p className="text-slate-400">작업이 완료된 현장의 정산 내역을 확인하고 국세청 연동 세금계산서를 일괄 발행합니다.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setIsClientModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
          >
            <Building2 size={18} /> 거래처 관리
          </button>
          <button 
            onClick={handleBulkIssue}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <Send size={18} /> 선택 항목 일괄 발행 ({selectedIds.size}건)
          </button>
        </div>
      </header>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
          <p className="text-slate-400 font-medium mb-1">발행 대기 중인 현장</p>
          <h3 className="text-3xl font-bold text-white">{completedProjects.length}건</h3>
        </div>
        <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <p className="text-blue-400 font-medium mb-1">선택된 현장 정산액 (예상)</p>
          <h3 className="text-3xl font-bold text-white">{totalAmount.toLocaleString()}원</h3>
        </div>
        <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
          <p className="text-slate-400 font-medium mb-1">이번 달 총 발행액</p>
          <h3 className="text-3xl font-bold text-slate-500">데이터 연동 중...</h3>
        </div>
      </div>

      {/* 필터 및 검색 바 */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="현장명, 작업자명 검색..." 
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
        <button className="px-4 py-3 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 flex items-center gap-2">
          <Filter size={20} /> 상세 필터
        </button>
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-1 flex flex-col">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="p-4 w-16 text-center">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white transition-colors">
                  {selectedIds.size === completedProjects.length && completedProjects.length > 0 ? 
                    <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} />
                  }
                </button>
              </th>
              <th className="p-4 text-slate-300 font-semibold">현장명</th>
              <th className="p-4 text-slate-300 font-semibold">담당 작업자</th>
              <th className="p-4 text-slate-300 font-semibold">청구 금액 (VAT 별도)</th>
              <th className="p-4 text-slate-300 font-semibold">작업 완료일</th>
              <th className="p-4 text-slate-300 font-semibold">증빙 서류</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</td>
              </tr>
            ) : completedProjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">발행 대기 중인 완료 현장이 없습니다.</td>
              </tr>
            ) : (
              (completedProjects as (ProjectData & { price: number })[]).map((project) => (
                <tr key={project.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors group">
                  <td className="p-4 text-center">
                    <button onClick={() => toggleSelect(project.id)} className="text-slate-500 group-hover:text-slate-300 transition-colors">
                      {selectedIds.has(project.id) ? 
                        <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} />
                      }
                    </button>
                  </td>
                  <td className="p-4 font-medium text-white">{project.name}</td>
                  <td className="p-4 text-slate-400">{project.workerName}</td>
                  <td className="p-4 font-semibold text-blue-400">{project.price.toLocaleString()} 원</td>
                  <td className="p-4 text-slate-500">2026.05.08 11:30 (예시)</td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                      검수 완
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ClientManagerModal 
        isOpen={isClientModalOpen} 
        onClose={() => setIsClientModalOpen(false)} 
      />
      
      <InvoiceIssueModal 
        isOpen={isInvoiceModalOpen} 
        onClose={() => setIsInvoiceModalOpen(false)}
        selectedProjects={selectedProjectsData}
        onSuccess={() => {
          setIsInvoiceModalOpen(false);
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}
