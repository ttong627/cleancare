'use client';

import { useState } from 'react';
import { X, CreditCard, Banknote, Building2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Invoice, PaymentMethod } from '@/schema';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'BANK', label: '계좌이체', icon: <Building2 size={18} /> },
  { value: 'CARD', label: '카드 결제', icon: <CreditCard size={18} /> },
  { value: 'CASH', label: '현금', icon: <Banknote size={18} /> },
  { value: 'OTHER', label: '기타', icon: <CheckCircle2 size={18} /> },
];

export default function PaymentModal({ invoice, onClose, onSuccess }: Props) {
  const [paidAmount, setPaidAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BANK');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!invoice) return null;

  const supplyAmount = invoice.amount;
  const vatAmount = invoice.isVat ? Math.round(supplyAmount * 0.1) : 0;
  const totalAmount = supplyAmount + vatAmount;
  const alreadyPaid = invoice.paidAmount ?? 0;
  const balance = totalAmount - alreadyPaid;

  const parsedPaid = Number(paidAmount.replace(/,/g, '')) || 0;
  const newBalance = balance - parsedPaid;
  const isFullPayment = parsedPaid >= balance;
  const isOverPayment = parsedPaid > balance;

  const handleSave = async () => {
    if (parsedPaid <= 0) { toast.error('결제 금액을 입력해주세요.'); return; }
    if (isOverPayment) { toast.error('결제 금액이 잔액을 초과합니다.'); return; }

    setIsSaving(true);
    try {
      const newPaidTotal = alreadyPaid + parsedPaid;
      const newStatus: Invoice['paymentStatus'] = newPaidTotal >= totalAmount ? 'PAID' : newPaidTotal > 0 ? 'PARTIAL' : 'UNPAID';

      await updateDoc(doc(db, 'invoices', invoice.id), {
        paidAmount: newPaidTotal,
        paymentStatus: newStatus,
        paymentMethod: method,
        paidAt: Date.now(),
        memo: memo.trim() || null,
      });

      toast.success(isFullPayment ? '결제 완료! 잔액이 0원입니다.' : `부분 결제가 등록되었습니다. 잔액: ${newBalance.toLocaleString()}원`);
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error('결제 처리에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CreditCard size={20} className="text-emerald-500" />
            결제 처리
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 금액 요약 */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="text-sm font-bold text-slate-500 mb-3">{invoice.itemName}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>공급가액</span>
                <span>{supplyAmount.toLocaleString()}원</span>
              </div>
              {invoice.isVat && (
                <div className="flex justify-between text-slate-600">
                  <span>부가세 (10%)</span>
                  <span>{vatAmount.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2">
                <span>청구 합계</span>
                <span>{totalAmount.toLocaleString()}원</span>
              </div>
              {alreadyPaid > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>기납부액</span>
                  <span>- {alreadyPaid.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between font-black text-red-600 border-t border-slate-200 pt-2 text-base">
                <span>미수금 (잔액)</span>
                <span>{balance.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          {/* 결제 수단 선택 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">결제 수단</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => setMethod(pm.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    method === pm.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {pm.icon}
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* 결제 금액 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">결제 금액</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={paidAmount}
                onChange={e => {
                  const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                  setPaidAmount(raw ? Number(raw).toLocaleString() : '');
                }}
                placeholder="0"
                className={`w-full px-4 py-3 border-2 rounded-xl text-right text-lg font-bold outline-none transition-all ${
                  isOverPayment ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-emerald-500'
                }`}
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">원</span>
            </div>
            {paidAmount && (
              <div className={`mt-2 text-sm font-semibold flex items-center gap-1 ${isOverPayment ? 'text-red-500' : isFullPayment ? 'text-emerald-600' : 'text-blue-600'}`}>
                {isOverPayment && <AlertCircle size={14} />}
                {isFullPayment && <CheckCircle2 size={14} />}
                {isOverPayment
                  ? '잔액을 초과합니다.'
                  : isFullPayment
                  ? '전액 결제 처리됩니다.'
                  : `결제 후 잔액: ${newBalance.toLocaleString()}원`
                }
              </div>
            )}
          </div>

          {/* 빠른 금액 선택 */}
          <div className="flex gap-2">
            <button
              onClick={() => setPaidAmount(Math.round(balance / 2).toLocaleString())}
              className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            >
              1/2 결제 ({Math.round(balance / 2).toLocaleString()}원)
            </button>
            <button
              onClick={() => setPaidAmount(balance.toLocaleString())}
              className="flex-1 py-2 text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors"
            >
              전액 결제 ({balance.toLocaleString()}원)
            </button>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 1차 분납, 카드 승인번호 등"
              className="w-full px-4 py-3 border-2 border-slate-200 focus:border-emerald-400 rounded-xl outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !paidAmount || parsedPaid <= 0 || isOverPayment}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            결제 완료 처리
          </button>
        </div>
      </div>
    </div>
  );
}
