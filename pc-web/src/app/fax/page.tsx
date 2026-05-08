'use client';

import { Printer, Send } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function FaxPage() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBulkFax = () => {
    setIsProcessing(true);
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: '교육청 및 관공서로 모바일/PC 통합 팩스 발송 중...',
        success: () => {
          setIsProcessing(false);
          return <b>3건의 서류 팩스 발송이 완료되었습니다!</b>;
        },
        error: () => {
          setIsProcessing(false);
          return <b>발송 실패</b>;
        },
      }
    );
  };

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Printer className="text-teal-500" size={32} />
            관공서 팩스 일괄 전송 (PC/모바일 통합)
          </h1>
          <p className="text-slate-400">현장 작업자가 모바일 앱에서 전송하거나, 관리자가 PC에서 일괄 발송할 수 있는 통합 팩스 시스템입니다.</p>
        </div>
        <button 
          onClick={handleBulkFax}
          disabled={isProcessing}
          className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg shadow-teal-500/20 transition-colors"
        >
          <Send size={18} /> 선택 항목 팩스 발송
        </button>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex-1 flex flex-col items-center justify-center text-center">
        <Printer className="text-slate-700 mb-4" size={64} />
        <h2 className="text-xl font-bold text-white mb-2">통합 웹팩스 대기열</h2>
        <p className="text-slate-400 max-w-lg mb-6">
          현재 모바일 기기(현장실무자)에서 요청된 팩스와 PC에서 발송 대기 중인 증빙 서류들이 이곳에 표시됩니다.<br/>
          (데이터 연동 중...)
        </p>
      </div>
    </div>
  );
}
