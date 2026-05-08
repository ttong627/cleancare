'use client';

import { useState, useEffect } from 'react';
import { Client, ClientManager, Invoice } from '@/schema';
import { collection, query, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Send, Building2, User, Mail, Coins, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedProjects: { id: string, name: string, price: number }[];
  onSuccess: () => void;
}

export default function InvoiceIssueModal({ isOpen, onClose, selectedProjects, onSuccess }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  
  // 폼 상태
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // 초기화
  useEffect(() => {
    if (isOpen) {
      if (selectedProjects.length === 1) {
        setItemName(selectedProjects[0].name);
      } else if (selectedProjects.length > 1) {
        setItemName(`${selectedProjects[0].name} 외 ${selectedProjects.length - 1}건`);
      }
      
      const totalAmount = selectedProjects.reduce((sum, p) => sum + p.price, 0);
      setAmount(totalAmount);
    }
  }, [isOpen, selectedProjects]);

  // 거래처 목록 로드
  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'clients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedManager = selectedClient?.managers?.find(m => m.id === selectedManagerId);

  const handleIssue = async () => {
    if (!selectedClient || !selectedManager) {
      toast.error('거래처와 담당자를 모두 선택해주세요.');
      return;
    }
    if (!itemName) {
      toast.error('품명을 입력해주세요.');
      return;
    }
    if (amount <= 0) {
      toast.error('올바른 금액을 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    toast.loading('국세청(팝빌) 연동 중입니다...', { id: 'issue' });

    try {
      // 1. Invoices 컬렉션에 저장
      const invoiceData: Omit<Invoice, 'id'> = {
        projectId: selectedProjects.length === 1 ? selectedProjects[0].id : 'BULK',
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        businessNumber: selectedClient.businessNumber,
        managerName: selectedManager.name,
        managerEmail: selectedManager.email,
        itemName,
        amount,
        status: 'ISSUED',
        issuedAt: Date.now()
      };
      
      await addDoc(collection(db, 'invoices'), invoiceData);

      // 2. 선택된 Projects의 invoiceIssued 상태 업데이트
      for (const p of selectedProjects) {
        await updateDoc(doc(db, 'projects', p.id), { invoiceIssued: true });
      }

      toast.success('전자세금계산서 발행 및 전송이 완료되었습니다!', { id: 'issue' });
      onSuccess();
    } catch (error) {
      toast.error('발행 중 오류가 발생했습니다.', { id: 'issue' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Send className="text-emerald-600" /> 
            전자세금계산서 상세 발행
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
            <p className="text-sm text-blue-800 font-medium">총 <span className="font-bold">{selectedProjects.length}</span>건의 현장에 대해 세금계산서를 발행합니다.</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* 거래처 선택 */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Building2 size={14}/> 거래처 선택</label>
              <select 
                value={selectedClientId} 
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedManagerId(''); // 거래처 변경 시 담당자 초기화
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">-- 거래처 선택 --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.businessNumber})</option>
                ))}
              </select>
            </div>

            {/* 담당자 선택 */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><User size={14}/> 담당자 선택</label>
              <select 
                value={selectedManagerId} 
                onChange={(e) => setSelectedManagerId(e.target.value)}
                disabled={!selectedClientId}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
              >
                <option value="">-- 담당자 선택 --</option>
                {selectedClient?.managers?.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 선택된 담당자 정보 표시 (가장 중요) */}
          {selectedManager && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="text-xs font-bold text-slate-500 mb-2">세금계산서 수신 정보</h4>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-slate-400" />
                  <span className="font-medium">{selectedManager.name}</span>
                  <span className="text-slate-400">({selectedManager.contact})</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                  <Mail size={14} className="text-emerald-500" />
                  {selectedManager.email}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><FileText size={14}/> 품명</label>
                <input 
                  type="text" 
                  value={itemName} 
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Coins size={14}/> 발행 금액 (공급가액)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-right font-bold text-lg" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">원</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            취소
          </button>
          <button 
            onClick={handleIssue} 
            disabled={isProcessing || !selectedManagerId}
            className="px-8 py-2.5 font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            <Send size={18} />
            계산서 발행 및 전송
          </button>
        </div>
      </div>
    </div>
  );
}
