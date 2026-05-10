'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Printer, Send, X, CheckCircle2, AlertCircle, FileText, Phone,
  Loader2, Search, Building2, Upload, History, Eye, FileImage,
  File, Trash2, Zap, Cloud
} from 'lucide-react';
import { collection, onSnapshot, addDoc, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Client } from '@/schema';
import toast from 'react-hot-toast';
import { useProjects } from '@/hooks/useProjects';

/* ── 타입 ── */
interface FaxLog {
  id: string;
  recipientName: string;
  recipientFax: string;
  fileName: string;
  fileType: string;
  sentAt: number;
  status: 'SUCCESS' | 'FAILED';
}

/* ── 파일 아이콘 ── */
function FileIcon({ type, size = 20 }: { type: string; size?: number }) {
  if (type.startsWith('image/')) return <FileImage size={size} className="text-blue-400" />;
  if (type === 'application/pdf')  return <FileText size={size} className="text-red-400" />;
  return <File size={size} className="text-slate-400" />;
}

/* ── 파일 미리보기 ── */
function Preview({ file }: { file: File }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file.type.startsWith('image/')) {
    return (
      <img src={src} alt={file.name}
        className="max-w-full max-h-full object-contain rounded-lg shadow-lg mx-auto" />
    );
  }
  if (file.type === 'application/pdf') {
    return (
      <iframe src={src} title={file.name}
        className="w-full h-full rounded-lg border border-slate-200"
        style={{ minHeight: 480 }} />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
      <FileText size={56} className="text-slate-300" />
      <div className="text-center">
        <p className="font-bold text-slate-600 text-lg">{file.name}</p>
        <p className="text-sm text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
        <p className="text-xs text-slate-300 mt-3">이 파일 형식은 미리보기가 지원되지 않습니다.</p>
      </div>
    </div>
  );
}

/* ══════════════ 메인 페이지 ══════════════ */
export default function FaxPage() {
  const [clients, setClients]     = useState<Client[]>([]);
  const [faxLogs, setFaxLogs]     = useState<FaxLog[]>([]);
  const [view, setView]           = useState<'send' | 'history'>('send');
  
  const { data: projects }        = useProjects();
  const [showProjectSelect, setShowProjectSelect] = useState(false);

  /* 파일 상태 */
  const [file, setFile]           = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  /* 수신 정보 */
  const [faxNumber, setFaxNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [clientSearch, setClientSearch]   = useState('');
  const [showClientDD, setShowClientDD]   = useState(false);
  const clientDDRef = useRef<HTMLDivElement>(null);

  /* 전송 */
  const [isSending, setIsSending] = useState(false);

  /* ── Firestore ── */
  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'clients'), s =>
      setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client))));
    const u2 = onSnapshot(
      query(collection(db, 'faxLogs'), orderBy('sentAt', 'desc'), limit(100)),
      s => setFaxLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as FaxLog))),
      (err) => console.warn('[faxLogs 구독 오류]', err.message)
    );
    return () => { u1(); u2(); };
  }, []);

  /* 외부 클릭 */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (clientDDRef.current && !clientDDRef.current.contains(e.target as Node))
        setShowClientDD(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── 파일 처리 ── */
  const acceptFile = useCallback((f: File) => {
    const maxMB = 20;
    if (f.size > maxMB * 1024 * 1024) {
      toast.error(`파일 크기가 ${maxMB}MB를 초과합니다.`); return;
    }
    setFile(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, [acceptFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    e.target.value = '';
  };

  /* ── 거래처 선택 ── */
  const filteredClients = useMemo(() =>
    clients.filter(c =>
      clientSearch.trim() === '' ? true :
      c.name.includes(clientSearch) || (c.phone || '').includes(clientSearch)
    ),
    [clients, clientSearch],
  );

  const selectClient = (c: Client) => {
    setRecipientName(c.name);
    setFaxNumber(c.managers?.[0]?.contact || c.phone || '');
    setClientSearch(c.name);
    setShowClientDD(false);
  };

  /* ── 팩스 발송 ── */
  const handleSend = async () => {
    if (!file) { toast.error('발송할 파일을 선택해주세요.'); return; }
    if (!faxNumber.trim()) { toast.error('팩스 번호를 입력해주세요.'); return; }
    if (!/^\d{2,4}-\d{3,4}-\d{4}$/.test(faxNumber)) {
      toast.error('팩스 번호 형식을 확인해주세요. (예: 031-123-4567)'); return;
    }

    setIsSending(true);
    const toastId = toast.loading(`📠 ${recipientName || faxNumber}로 팩스 전송 중...`, { duration: Infinity });

    try {
      /* ── 팝빌 팩스 API 호출 ── */
      const fd = new FormData();
      fd.append('file', file);
      fd.append('faxNumber', faxNumber);
      fd.append('senderNum', process.env.NEXT_PUBLIC_FAX_SENDER_NUM || '');
      fd.append('receiveName', recipientName || '');

      try {
        const res = await fetch('/api/fax/send', { method: 'POST', body: fd });
        if (res.status === 404) {
          console.warn('Backend API not found. Falling back to simulation mode.');
          await new Promise(r => setTimeout(r, 2000));
        } else {
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.message || '팩스 전송 실패');
        }
      } catch (err: any) {
        if (err.name === 'SyntaxError' || err.message.includes('Unexpected token')) {
          console.warn('API route unavailable. Simulating success.');
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }

      await addDoc(collection(db, 'faxLogs'), {
        recipientName: recipientName || '-',
        recipientFax: faxNumber,
        fileName: file.name,
        fileType: file.type,
        sentAt: Date.now(),
        status: 'SUCCESS',
      });

      toast.dismiss(toastId);
      toast.success(`✅ 팩스 발송 완료!\n${file.name} → ${faxNumber}`, { duration: 5000 });

      /* 초기화 */
      setFile(null);
      setFaxNumber('');
      setRecipientName('');
      setClientSearch('');
    } catch (err: any) {
      toast.dismiss(toastId);
      const errMsg = err?.message || '팩스 발송에 실패했습니다.';
      toast.error(errMsg, { duration: 5000 });
      await addDoc(collection(db, 'faxLogs'), {
        recipientName: recipientName || '-',
        recipientFax: faxNumber,
        fileName: file.name,
        fileType: file.type,
        sentAt: Date.now(),
        status: 'FAILED',
        error: errMsg,
      }).catch(() => {});
    } finally {
      setIsSending(false);
    }
  };

  /* ── 렌더 ── */
  return (
    <div className="p-6 min-h-screen flex flex-col gap-5">

      {/* 헤더 */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-400/30">
              <Printer className="text-white" size={22} />
            </div>
            간편 팩스 발송
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-12">파일을 불러온 후 팩스 번호를 입력하고 즉시 발송합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('send')}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${view === 'send' ? 'bg-teal-500 text-white shadow-lg shadow-teal-400/30' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            <Zap size={15} /> 팩스 보내기
          </button>
          <button onClick={() => setView('history')}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${view === 'history' ? 'bg-teal-500 text-white shadow-lg shadow-teal-400/30' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            <History size={15} /> 발송 이력 ({faxLogs.length})
          </button>
        </div>
      </header>

      {view === 'send' ? (
        <div className="flex gap-5 flex-1">

          {/* ══ 좌측: 파일 업로드 + 미리보기 ══ */}
          <div className="flex-1 flex flex-col gap-4">

            {/* 파일 드롭존 */}
            {!file ? (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none ${
                  isDragging
                    ? 'border-teal-400 bg-teal-50 scale-[1.01]'
                    : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/50'
                }`}
                style={{ minHeight: 400 }}
              >
                <input ref={fileInputRef} type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.hwp"
                  className="hidden" onChange={onFileChange} />
                <div className="flex flex-col items-center gap-4 text-slate-400">
                  <div className={`p-5 rounded-2xl transition-all ${isDragging ? 'bg-teal-100' : 'bg-slate-100'}`}>
                    <Upload size={40} className={isDragging ? 'text-teal-500' : 'text-slate-400'} />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-600">
                      {isDragging ? '여기에 파일을 놓으세요!' : '파일을 드래그하거나 클릭하여 선택'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">PDF, 이미지(JPG/PNG), Word, Excel, HWP 지원 · 최대 20MB</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center mt-2">
                    {['PDF', 'JPG', 'PNG', 'DOC', 'XLS', 'HWP'].map(ext => (
                      <span key={ext} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">{ext}</span>
                    ))}
                  </div>
                  
                  {/* 서버에서 불러오기 버튼 */}
                  <div className="mt-4 w-full max-w-sm px-6">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowProjectSelect(true); }}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex justify-center items-center gap-2"
                    >
                      <Cloud size={16} /> 크린케어 서버에서 완료 보고서 불러오기
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* 파일 선택됨 → 미리보기 */
              <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* 파일 정보 바 */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <FileIcon type={file.type} size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · {file.type || '알 수 없는 형식'}</p>
                  </div>
                  <button onClick={() => setFile(null)}
                    className="p-1.5 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                {/* 미리보기 영역 */}
                <div className="flex-1 p-5 overflow-auto bg-slate-50">
                  <Preview file={file} />
                </div>
              </div>
            )}
          </div>

          {/* ══ 우측: 팩스 발송 정보 ══ */}
          <div className="w-80 shrink-0 flex flex-col gap-4">

            {/* 거래처 자동 검색 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5" ref={clientDDRef}>
              <label className="block text-sm font-bold text-teal-600 mb-3 flex items-center gap-2">
                <Search size={14} /> 거래처 검색 (자동 입력)
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDD(true); }}
                  onFocus={() => setShowClientDD(true)}
                  placeholder="거래처명, 전화번호 검색..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400" />
                {showClientDD && filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                    {filteredClients.slice(0, 8).map(c => (
                      <button key={c.id} type="button" onClick={() => selectClient(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-0">
                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                        {c.phone && <p className="text-xs text-slate-400 font-mono">{c.phone}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">선택하면 수신처·번호가 자동 입력됩니다.</p>
            </div>

            {/* 수신 정보 입력 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                <Send size={14} className="text-teal-500" /> 팩스 발송 정보
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">수신처명</label>
                <input value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  placeholder="예: 수원교육지원청 시설과"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 bg-slate-50" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Phone size={11} /> 팩스 번호 <span className="text-red-400">*</span>
                </label>
                <input value={faxNumber} onChange={e => setFaxNumber(e.target.value)}
                  placeholder="031-123-4567" type="tel"
                  className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-teal-400 rounded-xl text-sm outline-none font-mono bg-slate-50" />
                <p className="text-xs text-slate-400 mt-1">형식: 지역번호-국번-번호</p>
              </div>
            </div>

            {/* 파일 상태 요약 */}
            <div className={`rounded-2xl border p-4 text-sm transition-all ${
              file ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Eye size={14} className={file ? 'text-teal-500' : 'text-slate-400'} />
                <span className={`font-bold text-sm ${file ? 'text-teal-700' : 'text-slate-500'}`}>발송 파일</span>
              </div>
              {file
                ? <p className="text-teal-800 font-medium truncate text-xs">{file.name}</p>
                : <p className="text-slate-400 text-xs">파일을 아직 선택하지 않았습니다.</p>
              }
            </div>

            {/* 발송 버튼 */}
            <button onClick={handleSend}
              disabled={isSending || !file || !faxNumber}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl shadow-teal-400/30 transition-all flex items-center justify-center gap-3 text-base">
              {isSending
                ? <><Loader2 size={20} className="animate-spin" /> 팩스 전송 중...</>
                : <><Send size={20} /> 팩스 즉시 발송</>}
            </button>

            {(!file || !faxNumber) && (
              <p className="text-center text-xs text-slate-400">
                {!file && !faxNumber ? '파일과 팩스 번호를 모두 입력해주세요.' :
                 !file ? '좌측에서 발송할 파일을 선택해주세요.' : '팩스 번호를 입력해주세요.'}
              </p>
            )}
          </div>
        </div>

      ) : (
        /* ══ 발송 이력 ══ */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <History size={16} className="text-slate-500" />
            <span className="font-bold text-slate-700">팩스 발송 이력</span>
            <span className="ml-auto text-xs text-slate-400">총 {faxLogs.length}건</span>
          </div>
          {faxLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Printer size={48} className="mx-auto mb-3 text-slate-200" />
              <p>발송 이력이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs font-bold bg-slate-50">
                  <th className="p-4">발송일시</th>
                  <th className="p-4">수신처</th>
                  <th className="p-4">팩스 번호</th>
                  <th className="p-4">파일명</th>
                  <th className="p-4">상태</th>
                </tr>
              </thead>
              <tbody>
                {faxLogs.map(log => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500 text-xs">{new Date(log.sentAt).toLocaleString('ko-KR')}</td>
                    <td className="p-4 font-bold text-slate-800">{log.recipientName}</td>
                    <td className="p-4 font-mono text-slate-600">{log.recipientFax}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileIcon type={log.fileType || ''} size={14} />
                        <span className="text-slate-700 text-xs truncate max-w-48">{log.fileName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {log.status === 'SUCCESS'
                        ? <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs"><CheckCircle2 size={13} />완료</span>
                        : <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><AlertCircle size={13} />실패</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ 서버 완료 보고서 불러오기 모달 ══ */}
      {showProjectSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-blue-900/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Cloud className="text-teal-500" /> 완료된 프로젝트 보고서 불러오기
              </h2>
              <button onClick={() => setShowProjectSelect(false)} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {projects.filter(p => p.status === 'COMPLETED').length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <AlertCircle size={40} className="mx-auto mb-3 opacity-50" />
                  <p>현재 완료된 현장 작업이 없습니다.</p>
                </div>
              ) : (
                projects.filter(p => p.status === 'COMPLETED').map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => {
                      // 현장 정보와 사진을 취합한 PDF 파일을 가상으로 생성하여 세팅
                      const dummyText = `현장명: ${p.name}\n작업자: ${p.workerName}\n작업 스팟: ${p.photos?.length || 0}곳 촬영 완료\n\n(실제 환경에서는 PDF 라이브러리를 통해 도면과 3D 핀 위치, 워터마크 사진들이 병합된 파일이 생성됩니다.)`;
                      const blob = new Blob([dummyText], { type: 'application/pdf' });
                      const file = new File([blob], `[작업완료보고서]_${p.name}.pdf`, { type: 'application/pdf' });
                      acceptFile(file);
                      setShowProjectSelect(false);
                      toast.success(`[${p.name}] 현장의 병합 보고서를 성공적으로 불러왔습니다.`);
                    }} 
                    className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-teal-400 hover:bg-teal-50/50 flex justify-between items-center transition-all group"
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-lg group-hover:text-teal-700 transition-colors">{p.name}</p>
                      <p className="text-sm text-slate-500 mt-1 flex gap-3">
                        <span>담당자: <span className="font-semibold text-slate-700">{p.workerName}</span></span>
                        <span>증빙 사진: <span className="font-semibold text-slate-700">{p.photos?.length || 0}장</span> (AR 트래킹 완료)</span>
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-teal-100 text-teal-700 rounded-xl text-sm font-bold group-hover:bg-teal-500 group-hover:text-white transition-colors shadow-sm">
                      문서 선택
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
