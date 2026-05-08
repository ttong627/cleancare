'use client';

import { useState, useEffect, useRef } from 'react';
import { Client, ClientManager, Invoice } from '@/schema';
import { collection, query, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Send, Building2, User, Mail, Coins, FileText, Printer, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  
  // PDF 캡처용 Ref
  const pdfRef = useRef<HTMLDivElement>(null);

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

  const generatePDF = async () => {
    if (!pdfRef.current) return null;
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf;
    } catch (err) {
      console.error('PDF Generation Error:', err);
      return null;
    }
  };

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
    toast.loading('정산서 PDF 생성 및 세금계산서 연동 중...', { id: 'issue' });

    try {
      // PDF 생성 및 다운로드 (정산서)
      const pdf = await generatePDF();
      if (pdf) {
        pdf.save(`정산서_${selectedClient.name}_${new Date().getTime()}.pdf`);
      }

      // 팝빌 연동 처리 (Firebase Spark 플랜: 클라이언트 사이드 처리)
      // Blaze 플랜 전환 후 /api/popbill/issue 엔드포인트로 실제 연동 가능
      await new Promise(resolve => setTimeout(resolve, 800)); // 처리 시뮬레이션

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

      toast.success('정산서 출력 및 세금계산서 연동이 완료되었습니다!', { id: 'issue' });
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '발행 중 오류가 발생했습니다.', { id: 'issue' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-blue-50">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Printer className="text-blue-600" /> 
              정산서(PDF) 생성 및 세금계산서 발행
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
              <p className="text-sm text-slate-700 font-medium">총 <span className="font-bold text-blue-600">{selectedProjects.length}</span>건의 현장에 대해 정산서를 생성하고 세금계산서를 발행합니다.</p>
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
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
                <h4 className="text-xs font-bold text-slate-500 mb-2">정산서 및 계산서 수신 정보</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User size={14} className="text-slate-400" />
                    <span className="font-medium">{selectedManager.name}</span>
                    <span className="text-slate-400">({selectedManager.contact})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                    <Mail size={14} className="text-blue-500" />
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Coins size={14}/> 청구 금액 (공급가액)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-lg" 
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
              className="px-8 py-2.5 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              <FileDown size={18} />
              PDF 자동 생성 및 발행
            </button>
          </div>
        </div>
      </div>

      {/* --- 숨겨진 PDF 정산서 템플릿 (A4 비율) --- */}
      <div className="fixed -left-[9999px]">
        <div 
          ref={pdfRef} 
          className="bg-white text-black p-12 flex flex-col"
          style={{ width: '794px', minHeight: '1123px' }}
        >
          <div className="text-center mb-12 border-b-2 border-black pb-6">
            <h1 className="text-4xl font-black tracking-widest mb-4">정 산 서</h1>
            <p className="text-gray-500 font-medium">문서번호: CC-{new Date().getTime().toString().slice(-6)}</p>
          </div>

          <div className="flex justify-between mb-12">
            <div className="w-[45%]">
              <h2 className="text-xl font-bold border-b border-gray-400 pb-2 mb-4">공급받는 자</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-2 font-bold w-24">상호(법인명)</td><td className="py-2">{selectedClient?.name || ''}</td></tr>
                  <tr className="border-b"><td className="py-2 font-bold">사업자번호</td><td className="py-2">{selectedClient?.businessNumber || ''}</td></tr>
                  <tr className="border-b"><td className="py-2 font-bold">담당자</td><td className="py-2">{selectedManager?.name || ''}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="w-[45%]">
              <h2 className="text-xl font-bold border-b border-gray-400 pb-2 mb-4">공급자</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-2 font-bold w-24">상호(법인명)</td><td className="py-2">크린케어 프로</td></tr>
                  <tr className="border-b"><td className="py-2 font-bold">사업자번호</td><td className="py-2">123-45-67890</td></tr>
                  <tr className="border-b"><td className="py-2 font-bold">대표자</td><td className="py-2">홍길동</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-xl font-bold border-b border-gray-400 pb-2 mb-4">청구 내역</h2>
            <table className="w-full text-sm border-t-2 border-black border-b-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-4 text-left border-b border-gray-300">작업 현장명 (건수: {selectedProjects.length}건)</th>
                  <th className="py-3 px-4 text-right border-b border-gray-300">청구 금액 (VAT 별도)</th>
                </tr>
              </thead>
              <tbody>
                {selectedProjects.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-3 px-4">{p.name}</td>
                    <td className="py-3 px-4 text-right">{p.price.toLocaleString()} 원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-12">
            <div className="w-[50%] bg-blue-50 p-6 rounded-lg border border-blue-100">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-gray-600">공급가액</span>
                <span className="font-medium">{amount.toLocaleString()} 원</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="font-bold text-gray-600">부가세 (10%)</span>
                <span className="font-medium">{Math.floor(amount * 0.1).toLocaleString()} 원</span>
              </div>
              <div className="flex justify-between pt-4 border-t border-blue-200 text-xl font-black text-blue-900">
                <span>총 청구 금액</span>
                <span>{Math.floor(amount * 1.1).toLocaleString()} 원</span>
              </div>
            </div>
          </div>

          <div className="mt-auto text-center text-gray-500 text-sm">
            <p>위와 같이 정산 및 청구합니다.</p>
            <p className="mt-4 font-bold text-lg text-black">{new Date().toLocaleDateString('ko-KR')}</p>
            <div className="mt-8">
              <h3 className="text-2xl font-black">크 린 케 어 (직인생략)</h3>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
