'use client';

import { useRef } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { Invoice } from '@/schema';

interface Props {
  invoice: Invoice | null;
  type: 'receipt' | 'statement'; // 영수증 | 명세서
  onClose: () => void;
  companyName?: string;
  companyBizNum?: string;
  companyCeo?: string;
  companyPhone?: string;
  companyAddress?: string;
}

export default function PrintDocModal({
  invoice, type, onClose,
  companyName = '(주)클린케어',
  companyBizNum = '000-00-00000',
  companyCeo = '대표자',
  companyPhone = '000-0000-0000',
  companyAddress = '서울특별시',
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!invoice) return null;

  const supplyAmount = invoice.amount;
  const vatAmount = invoice.isVat ? Math.round(supplyAmount * 0.1) : 0;
  const totalAmount = supplyAmount + vatAmount;
  const issuedDate = new Date(invoice.issuedAt);

  const formatKRW = (n: number) => n.toLocaleString('ko-KR') + '원';

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>${type === 'receipt' ? '영수증' : '거래명세서'} - ${invoice.clientName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000; background: #fff; }
          .doc { width: 700px; margin: 20px auto; padding: 30px; border: 2px solid #000; }
          .doc-title { text-align: center; font-size: 28px; font-weight: 900; letter-spacing: 8px; margin-bottom: 6px; }
          .doc-stamp { text-align: center; font-size: 13px; color: #555; margin-bottom: 20px; }
          .section-title { font-size: 13px; font-weight: 700; background: #f0f0f0; padding: 4px 8px; border: 1px solid #999; margin-bottom: 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #999; border-top: none; margin-bottom: 16px; }
          .info-cell { padding: 6px 10px; border-right: 1px solid #ccc; font-size: 12px; }
          .info-cell:nth-child(even) { border-right: none; }
          .info-label { color: #555; font-size: 11px; margin-bottom: 2px; }
          .info-value { font-weight: 600; }
          .divider { border-top: 2px solid #000; margin: 16px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
          th { background: #f0f0f0; padding: 6px 8px; border: 1px solid #999; font-weight: 700; text-align: center; }
          td { padding: 6px 8px; border: 1px solid #ccc; text-align: center; }
          td.left { text-align: left; }
          td.right { text-align: right; }
          .total-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .total-table td { padding: 6px 12px; border: 1px solid #ccc; }
          .total-table .label { background: #f5f5f5; font-weight: 700; width: 140px; }
          .total-table .amount { text-align: right; font-weight: 600; }
          .total-row td { font-size: 15px; font-weight: 900; background: #fff3cd; }
          .sign-area { display: flex; justify-content: space-between; margin-top: 24px; }
          .sign-box { border: 1px solid #999; padding: 12px 20px; min-width: 180px; text-align: center; }
          .sign-label { font-size: 11px; color: #555; margin-bottom: 24px; }
          .sign-name { font-size: 13px; font-weight: 700; }
          .sign-stamp { font-size: 11px; color: #888; }
          .footer-note { margin-top: 16px; font-size: 11px; color: #555; border-top: 1px solid #ccc; padding-top: 10px; }
          @media print {
            body { margin: 0; }
            .doc { border: 2px solid #000; margin: 0 auto; }
          }
        </style>
      </head>
      <body>
        <div class="doc">
          <div class="doc-title">${type === 'receipt' ? '영 수 증' : '거 래 명 세 서'}</div>
          <div class="doc-stamp">(공급받는자 보관용)</div>

          <div class="section-title">▶ 공급자 정보</div>
          <div class="info-grid">
            <div class="info-cell"><div class="info-label">상호 (법인명)</div><div class="info-value">${companyName}</div></div>
            <div class="info-cell"><div class="info-label">사업자등록번호</div><div class="info-value">${companyBizNum}</div></div>
            <div class="info-cell"><div class="info-label">대표자</div><div class="info-value">${companyCeo}</div></div>
            <div class="info-cell"><div class="info-label">전화번호</div><div class="info-value">${companyPhone}</div></div>
            <div class="info-cell" style="grid-column: 1/-1"><div class="info-label">주소</div><div class="info-value">${companyAddress}</div></div>
          </div>

          <div class="section-title">▶ 공급받는자 정보</div>
          <div class="info-grid">
            <div class="info-cell"><div class="info-label">거래처명</div><div class="info-value">${invoice.clientName}</div></div>
            <div class="info-cell"><div class="info-label">사업자등록번호</div><div class="info-value">${invoice.businessNumber || '-'}</div></div>
            <div class="info-cell"><div class="info-label">담당자</div><div class="info-value">${invoice.managerName}</div></div>
            <div class="info-cell"><div class="info-label">이메일</div><div class="info-value">${invoice.managerEmail || '-'}</div></div>
          </div>

          <div class="section-title">▶ 거래 내역</div>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>품명 / 내역</th>
                <th>수량</th>
                <th>단가</th>
                <th>공급가액</th>
                ${invoice.isVat ? '<th>부가세(10%)</th>' : ''}
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td class="left">${invoice.itemName}</td>
                <td>1</td>
                <td class="right">${formatKRW(supplyAmount)}</td>
                <td class="right">${formatKRW(supplyAmount)}</td>
                ${invoice.isVat ? `<td class="right">${formatKRW(vatAmount)}</td>` : ''}
                <td class="right" style="font-weight:700">${formatKRW(totalAmount)}</td>
              </tr>
              <tr>
                <td colspan="${invoice.isVat ? 6 : 5}" class="right" style="background:#f9f9f9;font-weight:700">합 계</td>
                <td class="right" style="font-weight:700;color:#1a56db">${formatKRW(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <table class="total-table">
            <tr><td class="label">공급가액</td><td class="amount">${formatKRW(supplyAmount)}</td><td class="label">부가가치세</td><td class="amount">${formatKRW(vatAmount)}</td></tr>
            <tr class="total-row"><td class="label" colspan="2" style="text-align:center;">합계 금액 (청구액)</td><td class="amount" colspan="2" style="font-size:18px; color:#c0392b;">${formatKRW(totalAmount)}</td></tr>
          </table>

          <div class="sign-area">
            <div>
              <div style="font-size:12px; color:#555; margin-bottom:6px;">발행일자: ${issuedDate.toLocaleDateString('ko-KR')}</div>
              <div style="font-size:12px; color:#555;">거래번호: ${invoice.id.substring(0, 8).toUpperCase()}</div>
              ${invoice.memo ? `<div style="font-size:11px;color:#777;margin-top:8px;">※ ${invoice.memo}</div>` : ''}
            </div>
            <div class="sign-box">
              <div class="sign-label">공급자 확인</div>
              <div class="sign-name">${companyName}</div>
              <div class="sign-stamp">(인)</div>
            </div>
          </div>

          <div class="footer-note">
            ※ 본 ${type === 'receipt' ? '영수증' : '명세서'}은 실제 거래 내역을 기반으로 발행된 공식 문서입니다.<br/>
            ※ 문의사항: ${companyPhone}
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText size={20} className="text-blue-500" />
            {type === 'receipt' ? '영수증 미리보기' : '거래명세서 미리보기'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 미리보기 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div ref={printRef} className="bg-white border-2 border-slate-300 rounded-xl p-8 mx-auto max-w-lg shadow-md text-slate-800" style={{ fontFamily: "'Malgun Gothic', sans-serif" }}>
            <h1 className="text-2xl font-black text-center tracking-widest mb-1">{type === 'receipt' ? '영 수 증' : '거 래 명 세 서'}</h1>
            <p className="text-center text-slate-500 text-sm mb-6">(공급받는자 보관용)</p>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 mb-2">▼ 공급자</p>
                <p className="font-black text-base">{companyName}</p>
                <p className="text-slate-600">{companyBizNum}</p>
                <p className="text-slate-600">{companyCeo} 대표</p>
                <p className="text-slate-500 text-xs mt-1">{companyPhone}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <p className="text-xs font-bold text-blue-500 mb-2">▼ 공급받는자</p>
                <p className="font-black text-base">{invoice.clientName}</p>
                <p className="text-slate-600">{invoice.businessNumber || '-'}</p>
                <p className="text-slate-600">{invoice.managerName}</p>
                <p className="text-slate-500 text-xs mt-1">{invoice.managerEmail}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 border-b border-slate-200">거래 내역</div>
              <div className="p-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="font-semibold text-sm">{invoice.itemName}</span>
                  <span className="font-bold">{formatKRW(supplyAmount)}</span>
                </div>
                {invoice.isVat && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100 text-sm text-slate-600">
                    <span>부가가치세 (10%)</span>
                    <span>{formatKRW(vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3">
                  <span className="font-black text-base">합계 (청구액)</span>
                  <span className="font-black text-xl text-red-600">{formatKRW(totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end text-xs text-slate-500">
              <div>
                <p>발행일: {issuedDate.toLocaleDateString('ko-KR')}</p>
                <p>거래번호: {invoice.id.substring(0, 8).toUpperCase()}</p>
                {invoice.memo && <p className="mt-1">※ {invoice.memo}</p>}
              </div>
              <div className="text-right border border-slate-300 rounded-lg px-4 py-2">
                <p className="font-bold">{companyName}</p>
                <p className="text-slate-400">(인)</p>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 버튼 */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-white">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
            닫기
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            <Printer size={18} />
            {type === 'receipt' ? '영수증 인쇄 / PDF 저장' : '명세서 인쇄 / PDF 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
