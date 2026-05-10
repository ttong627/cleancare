'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Map as MapIcon, Plus, MapPin, Navigation, User, Phone, Edit2, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Building, Users, Receipt, Search, X as XIcon, Home, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Map as KakaoMap, CustomOverlayMap } from 'react-kakao-maps-sdk';
import { Client } from '@/schema';

interface SystemUser {
  id: string; name: string; email: string; phone?: string; role: string; isActive: boolean;
}

interface Assignment {
  id: string; name: string; date: string; workerName: string; status: string;
  address?: string; manager?: string; contact?: string; photoReq?: string; memo?: string;
  clientId?: string; clientName?: string; managerId?: string; workerId?: string; price?: number;
  isVat?: boolean;
}


const cardStyle = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(14,165,233,0.18)',
  borderRadius: '24px',
  boxShadow: '0 8px 32px rgba(14,165,233,0.14), 0 4px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
};

const GeocodedMarker = ({ job }: { job: Assignment }) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!job.address) return;
    let attempts = 0;
    const MAX = 20; // 최대 10초 대기 (500ms × 20)

    const tryGeocode = () => {
      attempts++;
      // kakao.maps.services 가 준비될 때까지 폴링
      if (typeof window === 'undefined' || !window.kakao?.maps?.services) {
        if (attempts < MAX) setTimeout(tryGeocode, 500);
        return;
      }
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(job.address!, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setCoords({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
        }
      });
    };
    tryGeocode();
  }, [job.address]);

  if (!coords) return null;

  return (
    <CustomOverlayMap position={coords} yAnchor={1}>
      <div className="flex flex-col items-center transition-all hover:-translate-y-1 cursor-pointer">
        <div className="p-3 rounded-2xl mb-2 min-w-[140px] text-center z-10"
          style={{ background: 'rgba(255,255,255,0.95)', border: '2px solid rgba(14,165,233,0.3)', boxShadow: '0 8px 24px rgba(14,165,233,0.2)' }}>
          <p className="font-bold text-sm truncate" style={{ color: '#0f172a' }}>{job.name}</p>
          <p className="text-xs font-bold mt-1" style={{ color: '#0ea5e9' }}>{job.workerName}</p>
          <p className="text-xs" style={{ color: '#94a3b8' }}>{job.date}</p>
        </div>
        <div className="w-10 h-10 rounded-full border-4 border-white flex items-center justify-center text-white"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 16px rgba(14,165,233,0.4)' }}>
          <MapPin size={18} />
        </div>
        <div className="w-3 h-3 rotate-45 -mt-1.5" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }} />
      </div>
    </CustomOverlayMap>
  );
};


const DEFAULT_FORM = {
  date: format(new Date(), 'yyyy-MM-dd'),
  name: '', address: '', manager: '', contact: '', photoReq: 'BEFORE_AFTER',
  memo: '', clientId: '', clientName: '', workerId: '', workerName: '',
  settlementAmount: '', isVat: false, status: 'PENDING' as Assignment['status'],
};

export default function AssignmentsPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'map' | 'list'>('calendar');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [workers, setWorkers] = useState<any[]>([]); // 현장 작업자
  const [isNewClient, setIsNewClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState(DEFAULT_FORM);
  // 구글 캘린더 Client ID 설정 모달
  const [isGCalSetupOpen, setIsGCalSetupOpen] = useState(false);
  const [gcalClientInput, setGcalClientInput] = useState('');
  const [gcalClientIdFromDB, setGcalClientIdFromDB] = useState('');

  // 주소 검색 state
  const [addrKeyword, setAddrKeyword] = useState('');
  const [addrResults, setAddrResults] = useState<any[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrSearched, setAddrSearched] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let attempts = 0;
    const checkKakao = () => {
      attempts++;
      if (typeof window !== 'undefined') {
        if ((window as any).__kakao_error) {
          setLoading(false);
          setError(new Error('카카오맵 인증 실패(400 Bad Request) 또는 네트워크 오류입니다. .env.local의 카카오 JS 키가 올바른지, 카카오 개발자 콘솔에 도메인이 등록되어 있는지 확인해주세요.'));
          return;
        }
        if (window.kakao && window.kakao.maps) {
          setLoading(false);
          return;
        }
      }
      if (attempts > 20) {
        setLoading(false);
        setError(new Error('카카오맵 SDK를 불러올 수 없습니다. 브라우저 확장 프로그램(광고차단 등)을 확인해주세요.'));
      } else {
        setTimeout(checkKakao, 500);
      }
    };
    checkKakao();
  }, []);

  useEffect(() => {
    const unsubAssignments = onSnapshot(query(collection(db, 'projects')), (snapshot) => {
      setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
      setIsLoading(false);
    });
    const unsubClients = onSnapshot(query(collection(db, 'clients')), (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    });
    const unsubUsers = onSnapshot(query(collection(db, 'systemUsers')), (snapshot) => {
      setSystemUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemUser)));
    });
    const unsubWorkers = onSnapshot(query(collection(db, 'workers')), (snapshot) => {
      setWorkers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAssignments(); unsubClients(); unsubUsers(); unsubWorkers(); };
  }, []);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }),
  }), [currentMonth]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalClientId = formData.clientId;
      if (isNewClient && formData.clientName) {
        const newClientRef = doc(collection(db, 'clients'));
        await setDoc(newClientRef, {
          name: formData.clientName,
          businessNumber: '',
          managers: [{ id: Date.now().toString(), name: formData.manager, contact: formData.contact, email: '' }],
          createdAt: Date.now(),
        });
        finalClientId = newClientRef.id;
      }

      const payload = {
        name: formData.name, date: formData.date, address: formData.address,
        manager: formData.manager, contact: formData.contact, photoReq: formData.photoReq,
        memo: formData.memo, clientId: finalClientId, clientName: formData.clientName,
        workerId: formData.workerId, workerName: formData.workerName || '미배정',
        price: Number(formData.settlementAmount) || null,
        isVat: formData.isVat || false,
      };

      if (editingId) {
        await updateDoc(doc(db, 'projects', editingId), { ...payload, status: formData.status, updatedAt: Date.now() });
        toast.success('일정이 수정되었습니다.');
      } else {
        await setDoc(doc(db, 'projects', Date.now().toString()), {
          ...payload, status: 'PENDING', createdAt: Date.now(),
        });
        
        toast.success(
          (t) => {
            const startDate = formData.date.replace(/-/g, '');
            const title = encodeURIComponent(`[현장작업] ${formData.clientName || formData.name}`);
            const details = encodeURIComponent(`담당자: ${formData.manager} (${formData.contact})\n현장작업자: ${formData.workerName}\n주소: ${formData.address}\n비고: ${formData.memo}`);
            const loc = encodeURIComponent(formData.address);
            // workers 컬렉션에서 googleEmail 우선 사용, 없으면 systemUsers email
            const workerGoogleEmail =
              workers.find(w => w.id === formData.workerId)?.googleEmail ||
              systemUsers.find(u => u.id === formData.workerId)?.email ||
              '';
            const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${loc}&dates=${startDate}T000000Z/${startDate}T090000Z${workerGoogleEmail ? `&add=${encodeURIComponent(workerGoogleEmail)}` : ''}`;
            
            return (
              <div className="flex flex-col gap-3 py-1">
                <span className="font-bold text-slate-800">작업 현장이 시스템에 등록되었습니다! 🎉</span>
                <span className="text-sm text-slate-600">              작업자의 핸드폰 구글 캘린더에도 일정을 공유하시겠습니까?
                    {workerGoogleEmail
                      ? <span className="text-xs text-emerald-600 font-bold"> ({workerGoogleEmail})</span>
                      : <span className="text-xs text-red-400"> (작업자 구글 이메일 미등록 — 현장 작업자 관리에서 등록 필요)</span>
                    }</span>
                <button 
                  onClick={() => {
                    toast.dismiss(t.id);
                    window.open(gcalUrl, '_blank');
                  }}
                  className="flex justify-center items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
                >
                  📅 구글 캘린더 등록 & 작업자 자동 초대
                </button>
              </div>
            );
          },
          { duration: 15000, style: { minWidth: '340px' } }
        );
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(DEFAULT_FORM);
      setIsNewClient(false);
    } catch { toast.error(editingId ? '수정 실패' : '등록 실패'); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 작업 일정을 영구 삭제하시겠습니까?')) {
      try { await deleteDoc(doc(db, 'projects', id)); toast.success('삭제되었습니다.'); }
      catch { toast.error('삭제 실패'); }
    }
  };

  // 빈 날짜 클릭 → 신규 등록
  const openModalForDate = (dateStr: string) => {
    setEditingId(null);
    setFormData({ ...DEFAULT_FORM, date: dateStr });
    setIsModalOpen(true);
  };

  // 기존 일정 클릭 → 수정 모드
  const openModalForEdit = (e: React.MouseEvent, job: Assignment) => {
    e.stopPropagation();
    setEditingId(job.id);
    setFormData({
      date: job.date,
      name: job.name,
      address: job.address ?? '',
      manager: job.manager ?? '',
      contact: job.contact ?? '',
      photoReq: job.photoReq ?? 'BEFORE_AFTER',
      memo: job.memo ?? '',
      clientId: job.clientId ?? '',
      clientName: job.clientName ?? '',
      workerId: job.workerId ?? '',
      workerName: job.workerName ?? '',
      settlementAmount: (job.price ?? '').toString(),
      isVat: job.isVat ?? false,
      status: (job.status ?? 'PENDING') as Assignment['status'],
    });
    setIsNewClient(false);
    setIsModalOpen(true);
  };

  const inputStyle = {
    background: '#ffffff',
    border: '1.5px solid rgba(14,165,233,0.25)',
    borderRadius: '12px',
    color: '#0f172a',
    padding: '12px 16px',
    width: '100%',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  };

  // ── 구글 캘린더 Client ID DB에서 로드 ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'googleCalendar'), (snap) => {
      if (snap.exists()) setGcalClientIdFromDB(snap.data().clientId || '');
    });
    return () => unsub();
  }, []);

  const handleSaveGcalClientId = async () => {
    if (!gcalClientInput.trim()) { toast.error('Client ID를 입력해주세요.'); return; }
    try {
      await setDoc(doc(db, 'settings', 'googleCalendar'), { clientId: gcalClientInput.trim() }, { merge: true });
      setGcalClientIdFromDB(gcalClientInput.trim());
      setIsGCalSetupOpen(false);
      toast.success('구글 클라이언트 ID가 저장되었습니다!');
    } catch { toast.error('저장에 실패했습니다.'); }
  };

  // ── 구글 캘린더 전체 동기화 (GIS 방식) ──
  const handleSyncGoogleCalendar = async () => {
    const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || gcalClientIdFromDB;

    if (!CLIENT_ID) {
      setGcalClientInput('');
      setIsGCalSetupOpen(true);
      return;
    }

    // Google Identity Services 스크립트 동적 로드
    await new Promise<void>((resolve, reject) => {
      if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
      const existing = document.getElementById('gsi-script');
      if (existing) { resolve(); return; }
      const script = document.createElement('script');
      script.id = 'gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Identity Services 로드 실패'));
      document.head.appendChild(script);
    });

    // 토큰 클라이언트 생성 후 인증 요청
    (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          toast.error('구글 인증 실패: ' + tokenResponse.error);
          return;
        }

        const token = tokenResponse.access_token;
        toast.loading(`총 ${assignments.length}개 일정 동기화 중...`, { id: 'gcal-sync' });

        let successCount = 0;

        for (const job of assignments) {
          // Firebase ID → 구글 캘린더 이벤트 ID 규격(소문자 hex) 변환
          const eventId = job.id.split('').map((c: string) => c.charCodeAt(0).toString(16)).join('').toLowerCase().substring(0, 40);

          const endDate = new Date(job.date);
          endDate.setDate(endDate.getDate() + 1);

          const event = {
            summary: `[크린케어] ${job.clientName || job.name}`,
            location: job.address || '',
            description: [
              `담당자: ${job.manager || '-'} (${job.contact || '-'})`,
              `현장작업자: ${job.workerName || '-'}`,
              `금액: ${job.price ? job.price.toLocaleString() + '원' : '미정'}`,
              `메모: ${job.memo || '-'}`,
            ].join('\n'),
            start: { date: job.date, timeZone: 'Asia/Seoul' },
            end: { date: endDate.toISOString().split('T')[0], timeZone: 'Asia/Seoul' },
            // 작업자 구글 이메일로 초대 추가
            attendees: (() => {
              const emails: { email: string }[] = [];
              const gEmail = workers.find(w => w.id === job.workerId)?.googleEmail
                || systemUsers.find(u => u.id === job.workerId)?.email;
              if (gEmail) emails.push({ email: gEmail });
              return emails;
            })(),
          };

          try {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
              {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
              }
            );
            if (res.ok) successCount++;
          } catch { /* 개별 실패는 건너뜀 */ }
        }

        toast.success(
          `✅ ${successCount}개 일정이 구글 캘린더에 동기화되었습니다!`,
          { id: 'gcal-sync', duration: 4000 }
        );
      },
    }).requestAccessToken();
  };


  return (
    <div className="p-4 md:p-8 min-h-screen flex flex-col max-w-7xl mx-auto">
      {/* 헤더 */}
      <header className="mb-8 flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4 md:gap-0 pb-6" style={{ borderBottom: '1.5px solid rgba(14,165,233,0.15)' }}>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 mb-1" style={{ color: '#0f172a' }}>
            <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg,#0ea5e9,#06b6d4)', boxShadow: '0 4px 16px rgba(14,165,233,0.4)' }}>
              <CalendarIcon className="text-white" size={24} />
            </div>
            현장 배정 및 일정 관리
          </h1>
          <p className="ml-14 font-medium" style={{ color: '#64748b' }}>일자별 현장을 등록하고, 실시간 카카오 지도로 작업자의 위치를 관제합니다.</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {isLoading && <Loader2 className="animate-spin shrink-0" size={24} style={{ color: '#0ea5e9' }} />}

          <div className="flex p-1 rounded-2xl gap-1 shrink-0 bg-white border border-slate-200 shadow-sm">
            {[{ label: '📅 캘린더 뷰', val: 'calendar' as const }, { label: '🗺️ 지도 관제', val: 'map' as const }, { label: '📋 작업 내역', val: 'list' as const }].map(v => (
              <button key={v.val} onClick={() => setViewMode(v.val)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  viewMode === v.val
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >{v.label}</button>
            ))}
          </div>

          <button
            onClick={handleSyncGoogleCalendar}
            className="flex items-center gap-2 px-5 py-3 text-slate-700 bg-white border border-slate-200 rounded-2xl font-bold text-sm whitespace-nowrap shrink-0 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md"
            title="모든 일정을 내 구글 캘린더로 즉시 동기화합니다."
          >
            <img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" className="w-5 h-5 shrink-0" alt="Google Calendar" />
            구글 캘린더 계정 연동 및 전체 동기화
          </button>

          <button
            onClick={() => { setFormData(DEFAULT_FORM); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold text-sm whitespace-nowrap shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-lg shadow-blue-500/30 bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            <Plus size={18} className="shrink-0" /> 현장 신규 등록
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative rounded-3xl" style={cardStyle}>
        {viewMode === 'calendar' && (
          <div className="flex-1 flex flex-col bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.2)' }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
                  {format(currentMonth, 'yyyy년 M월')}
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"><ChevronLeft size={20} className="text-slate-600" /></button>
                <button onClick={() => setCurrentMonth(new Date())} className="px-5 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">오늘</button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"><ChevronRight size={20} className="text-slate-600" /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className={`py-3 text-center text-sm font-black tracking-tight ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-600' : 'text-slate-600'}`}>{d}</div>
              ))}
            </div>
            
            <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-100 gap-px border-t border-slate-200">
              {calendarDays.map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayJobs = assignments.filter(j => j.date === dateStr);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);
                
                return (
                  <div key={dateStr} 
                    onClick={() => openModalForDate(dateStr)}
                    className={`bg-white p-2.5 flex flex-col cursor-pointer transition-colors hover:bg-blue-50/30 group relative ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${isTodayDate ? 'bg-blue-500 text-white shadow-md' : 'text-slate-700 group-hover:text-blue-600 group-hover:bg-blue-100'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-blue-100 rounded-lg">
                        <Plus size={14} className="text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
                      {dayJobs.map(job => (
                        <div key={job.id}
                          className="group/chip px-2.5 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer relative"
                          style={{
                            background: job.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : job.status === 'IN_PROGRESS' ? 'rgba(245,158,11,0.1)' : 'rgba(14,165,233,0.1)',
                            color: job.status === 'COMPLETED' ? '#059669' : job.status === 'IN_PROGRESS' ? '#d97706' : '#0284c7',
                            border: `1px solid ${job.status === 'COMPLETED' ? 'rgba(16,185,129,0.2)' : job.status === 'IN_PROGRESS' ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.2)'}`
                          }}
                        >
                          <div onClick={(e) => openModalForEdit(e, job)} className="truncate mb-0.5 pr-4">{job.name}</div>
                          <div onClick={(e) => openModalForEdit(e, job)} className="flex items-center gap-1 opacity-80 text-[10px] font-medium">
                            <User size={10} /> {job.workerName}
                          </div>
                          <button
                            onClick={(e) => handleDelete(e, job.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover/chip:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100"
                            title="삭제"
                          >
                            <XIcon size={11} className="text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="flex-1 p-6 flex flex-col overflow-auto rounded-2xl" style={{ background: 'rgba(255,255,255,0.6)' }}>
            <h2 className="text-2xl font-black mb-5" style={{ color: '#0f172a' }}>전체 작업 내역</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <th className="p-4 font-bold">작업일</th>
                    <th className="p-4 font-bold">현장명</th>
                    <th className="p-4 font-bold">거래처/담당자</th>
                    <th className="p-4 font-bold">배정 작업자</th>
                    <th className="p-4 font-bold text-right">정산 금액</th>
                    <th className="p-4 font-bold text-center">상태</th>
                    <th className="p-4 font-bold text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {[...assignments].sort((a,b) => b.date.localeCompare(a.date)).map(job => (
                    <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700">{job.date}</td>
                      <td className="p-4 text-sm font-bold text-slate-800">{job.name}</td>
                      <td className="p-4 text-sm text-slate-600">
                        <span className="font-bold">{job.clientName || '미지정'}</span><br/>
                        <span className="text-xs text-slate-400">{job.manager} ({job.contact})</span>
                      </td>
                      <td className="p-4 text-sm text-blue-600 font-medium">{job.workerName}</td>
                      <td className="p-4 text-sm font-bold text-slate-700 text-right">{(Number(job.price) || 0).toLocaleString()}원</td>
                      <td className="p-4 text-center">
                        <select
                          value={job.status}
                          onChange={async (e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value as Assignment['status'];
                            try {
                              await updateDoc(doc(db, 'projects', job.id), { status: newStatus, updatedAt: Date.now() });
                              toast.success('상태가 변경되었습니다.');
                            } catch { toast.error('상태 변경에 실패했습니다.'); }
                          }}
                          className="text-xs font-bold rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer transition-all"
                          style={{
                            background: job.status === 'PENDING' ? '#f1f5f9' : job.status === 'IN_PROGRESS' ? '#dbeafe' : job.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                            color: job.status === 'PENDING' ? '#475569' : job.status === 'IN_PROGRESS' ? '#1d4ed8' : job.status === 'COMPLETED' ? '#166534' : '#991b1b',
                          }}
                        >
                          <option value="PENDING">대기 중</option>
                          <option value="IN_PROGRESS">진행 중</option>
                          <option value="COMPLETED">완료</option>
                          <option value="REJECTED">반려</option>
                        </select>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={(e) => openModalForEdit(e, job)} className="text-blue-500 hover:text-blue-700 text-sm font-bold mr-3 transition-colors">수정</button>
                        <button onClick={(e) => handleDelete(e, job.id)} className="text-red-400 hover:text-red-600 text-sm font-bold transition-colors">삭제</button>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">등록된 작업 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'map' && (
          <section className="flex-1 w-full relative rounded-3xl overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: 'rgba(240,249,255,0.9)' }}>
                <Loader2 className="animate-spin mb-3" size={40} style={{ color: '#0ea5e9' }} />
                <p className="text-sm font-bold text-slate-500">카카오 지도 로딩 중...</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8" style={{ background: 'rgba(240,249,255,0.97)' }}>
                <div className="w-full max-w-lg p-6 rounded-2xl" style={{ background: '#fff', border: '1.5px solid rgba(239,68,68,0.25)', boxShadow: '0 8px 24px rgba(239,68,68,0.1)' }}>
                  <h3 className="text-lg font-black mb-2 flex items-center gap-2" style={{ color: '#ef4444' }}>⚠️ 카카오맵 SDK 로딩 실패</h3>
                  <p className="text-sm text-slate-600 mb-3">카카오 개발자 콘솔에서 도메인이 등록되어 있는지 확인해주세요.</p>
                  <div className="p-3 rounded-xl font-mono text-xs" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.15)' }}>
                    {error instanceof Error ? error.message : String(error)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 z-0">
                <KakaoMap
                  center={{ lat: 37.2657, lng: 127.0195 }}
                  style={{ width: '100%', height: '100%' }}
                  level={6}
                >
                  {assignments.map((job) => (
                    <GeocodedMarker key={job.id} job={job} />
                  ))}
                </KakaoMap>
              </div>
            )}
            <div className="absolute bottom-6 left-6 p-4 rounded-2xl z-10" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 4px 16px rgba(14,165,233,0.15)' }}>
              <h3 className="font-bold flex items-center gap-2 text-sm" style={{ color: '#0f172a' }}>
                <Navigation size={18} style={{ color: '#0ea5e9' }} /> 일정 기반 위치 관제 ({assignments.length}건)
              </h3>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>등록된 일정을 기준으로 작업자의 위치를 모니터링합니다.</p>
            </div>
          </section>
        )}
      </main>

      {/* 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)' }}>
          <div className="w-[90vw] md:w-[720px] min-w-[320px] max-h-[90vh] flex flex-col overflow-hidden rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 32px 80px rgba(14,165,233,0.2), 0 12px 32px rgba(0,0,0,0.1)' }}>
            <div className="px-8 py-6 flex justify-between items-center" style={{ borderBottom: '1.5px solid rgba(14,165,233,0.12)', background: editingId ? 'linear-gradient(135deg,rgba(237,233,254,0.5),rgba(224,242,254,0.3))' : 'linear-gradient(135deg,rgba(224,242,254,0.5),rgba(237,233,254,0.3))' }}>
              <div>
                <h2 className="text-xl font-black flex items-center gap-3" style={{ color: '#0f172a' }}>
                  <div className="p-1.5 rounded-xl" style={{ background: editingId ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
                    {editingId ? <Edit2 className="text-white" size={20} /> : <Plus className="text-white" size={20} />}
                  </div>
                  {editingId ? '작업 일정 수정' : '신규 작업 현장 등록'}
                </h2>
                <div className="flex items-center gap-3 mt-1 ml-11">
                  <p className="text-sm" style={{ color: '#64748b' }}>
                    {editingId ? '수정 후 저장하면 즉시 반영됩니다.' : '입력된 주소는 카카오내비 연동을 위해 위경도로 자동 변환됩니다.'}
                  </p>
                  <div className="flex gap-2">
                    {editingId && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          const title = encodeURIComponent(`[${formData.clientName || '크린케어'}] ${formData.name}`);
                          const details = encodeURIComponent(`배정: ${formData.workerName}\n연락처: ${formData.contact}\n주소: ${formData.address}`);
                          // workers DB에서 googleEmail 조회
                          const workerGoogleEmail =
                            workers.find(w => w.id === formData.workerId)?.googleEmail ||
                            systemUsers.find(u => u.id === formData.workerId)?.email || '';
                          if (!workerGoogleEmail) {
                            toast.error('작업자 구글 이메일이 등록되지 않았습니다.\n현장 작업자 관리에서 먼저 이메일을 등록해주세요.');
                            return;
                          }
                          const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${encodeURIComponent(formData.address)}&dates=${formData.date.replace(/-/g,'')}T000000Z/${formData.date.replace(/-/g,'')}T090000Z&add=${encodeURIComponent(workerGoogleEmail)}`;
                          window.open(gcalUrl, '_blank');
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 font-bold transition-colors flex items-center gap-1"
                      >
                        📅 Google Calendar 연동
                      </button>
                    )}
                    {editingId && assignments.find(a => a.id === editingId)?.status === 'COMPLETED' && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = '/reports';
                        }}
                        className="text-xs px-3 py-1.5 bg-teal-50 text-teal-600 rounded border border-teal-100 hover:bg-teal-100 font-bold transition-colors flex items-center gap-1"
                      >
                        📝 작업 보고서 출력 (관리 메뉴)
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="p-2 rounded-xl transition-all" style={{ color: '#94a3b8', background: 'rgba(14,165,233,0.06)' }}>✕</button>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              <form id="reg-form" onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: '#334155' }}>작업 예정일</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: '#334155' }}>현장(프로젝트)명</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="예: 광교중학교 에어컨 세척" required style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 flex justify-between items-center" style={{ color: '#334155' }}>
                    <span>작업장 상세 주소</span>
                    <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#0ea5e9' }}><MapPin size={12} />Geocoding 자동 변환</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="주소를 입력하세요" required style={inputStyle} className="flex-1" />
                    <button type="button" onClick={() => setIsAddressModalOpen(true)} className="px-5 py-2.5 text-white rounded-xl font-bold whitespace-nowrap flex items-center gap-2 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ background: 'linear-gradient(135deg,#0ea5e9,#3b82f6)' }}>
                      <Search size={18} /> 주소 검색
                    </button>
                  </div>
                  {isAddressModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
                        {/* 헤더 */}
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-blue-50">
                          <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <MapPin size={18} className="text-blue-500" /> 주소 검색
                          </h3>
                          <button type="button" onClick={() => { setIsAddressModalOpen(false); setAddrResults([]); setAddrKeyword(''); setAddrSearched(false); }} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                            <XIcon size={18} />
                          </button>
                        </div>

                        {/* 검색창 */}
                        <div className="p-4 border-b border-slate-100">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={addrKeyword}
                              onChange={e => setAddrKeyword(e.target.value)}
                              onKeyDown={async e => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                if (!addrKeyword.trim()) return;
                                setAddrLoading(true);
                                setAddrSearched(true);
                                try {
                                  const key = process.env.NEXT_PUBLIC_JUSO_API_KEY || '';
                                  const res = await fetch(`https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=${key}&currentPage=1&countPerPage=20&keyword=${encodeURIComponent(addrKeyword)}&resultType=json`);
                                  const json = await res.json();
                                  setAddrResults(json?.results?.juso || []);
                                } catch { toast.error('주소 검색 중 오류가 발생했습니다.'); }
                                finally { setAddrLoading(false); }
                              }}
                              placeholder="건물명, 도로명, 지번 검색 후 Enter"
                              className="flex-1 px-4 py-2.5 border-2 border-slate-200 focus:border-blue-400 rounded-xl text-sm outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (!addrKeyword.trim()) return;
                                setAddrLoading(true);
                                setAddrSearched(true);
                                try {
                                  const key = process.env.NEXT_PUBLIC_JUSO_API_KEY || '';
                                  const res = await fetch(`https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=${key}&currentPage=1&countPerPage=20&keyword=${encodeURIComponent(addrKeyword)}&resultType=json`);
                                  const json = await res.json();
                                  setAddrResults(json?.results?.juso || []);
                                } catch { toast.error('주소 검색 중 오류가 발생했습니다.'); }
                                finally { setAddrLoading(false); }
                              }}
                              className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                            >
                              {addrLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                              검색
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">예: 신선중학교, 판교로 289, 분당구 백현동 539</p>
                        </div>

                        {/* 결과 목록 */}
                        <div className="overflow-y-auto flex-1">
                          {addrLoading ? (
                            <div className="flex items-center justify-center py-12 text-slate-400">
                              <Loader2 size={28} className="animate-spin mr-2" /> 검색 중...
                            </div>
                          ) : addrSearched && addrResults.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-sm">검색 결과가 없습니다.</div>
                          ) : addrResults.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                // 도로명 + 건물명 조합
                                const building = item.bdNm ? ` (${item.bdNm})` : '';
                                setFormData({ ...formData, address: item.roadAddr + building });
                                setIsAddressModalOpen(false);
                                setAddrResults([]);
                                setAddrKeyword('');
                                setAddrSearched(false);
                              }}
                              className="w-full px-5 py-4 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 group"
                            >
                              {/* 우편번호 + 건물명 행 */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-mono tracking-wider">
                                  {item.zipNo}
                                </span>
                                {item.bdNm && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                    <Building size={10} /> {item.bdNm}
                                  </span>
                                )}
                              </div>
                              {/* 도로명 주소 */}
                              <div className="flex items-start gap-2 mb-1">
                                <span className="shrink-0 text-xs font-black px-1.5 py-0.5 rounded bg-blue-500 text-white mt-0.5">도로명</span>
                                <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{item.roadAddr}</span>
                              </div>
                              {/* 지번 주소 */}
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-xs font-black px-1.5 py-0.5 rounded bg-slate-300 text-slate-600 mt-0.5">지&nbsp;&nbsp;&nbsp;번</span>
                                <span className="text-xs text-slate-400">{item.jibunAddr}</span>
                              </div>
                            </button>
                          ))}
                          {!addrSearched && (
                            <div className="py-10 text-center">
                              <Search size={36} className="mx-auto mb-3 text-slate-200" />
                              <p className="text-sm text-slate-400">건물명이나 주소를 입력하고 검색하세요</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5 p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg,rgba(224,242,254,0.4),rgba(237,233,254,0.3))', border: '1px solid rgba(14,165,233,0.12)' }}>
                  <div className="col-span-2">
                    <label className="flex items-center justify-between text-sm font-bold mb-2" style={{ color: '#334155' }}>
                      <span className="flex items-center gap-2"><Building size={14} style={{ color: '#0ea5e9' }} />거래처 지정</span>
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: '#0ea5e9' }}>
                        <input type="checkbox" checked={isNewClient} onChange={e => setIsNewClient(e.target.checked)} className="w-3.5 h-3.5" style={{ accentColor: '#0ea5e9' }} /> 신규 거래처로 등록
                      </label>
                    </label>
                    {isNewClient ? (
                      <input type="text" value={formData.clientName} onChange={e => setFormData({ ...formData, clientName: e.target.value })} placeholder="신규 거래처명" required style={inputStyle} />
                    ) : (
                      <select value={formData.clientId} onChange={e => {
                        const client = clients.find(c => c.id === e.target.value);
                        setFormData({ ...formData, clientId: e.target.value, clientName: client?.name || '', manager: '', contact: '' });
                      }} required style={inputStyle}>
                        <option value="">거래처 선택</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#334155' }}><User size={14} style={{ color: '#0ea5e9' }} />현장 담당자 (거래처 측)</label>
                    {!isNewClient && formData.clientId ? (
                      <div className="relative">
                        <input type="text" value={formData.manager} onChange={e => setFormData({ ...formData, manager: e.target.value })} placeholder="담당자명 직접 입력" required style={inputStyle} list="manager-list" />
                        <datalist id="manager-list">
                          {clients.find(c => c.id === formData.clientId)?.managers.map((m, idx) => <option key={idx} value={m.name}>{m.contact}</option>)}
                        </datalist>
                      </div>
                    ) : (
                      <input type="text" value={formData.manager} onChange={e => setFormData({ ...formData, manager: e.target.value })} placeholder="담당자명" required style={inputStyle} />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#334155' }}><Phone size={14} style={{ color: '#0ea5e9' }} />연락처</label>
                    <input type="tel" value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} placeholder="010-0000-0000" required style={inputStyle} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 p-5 rounded-2xl" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(14,165,233,0.12)' }}>
                  <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#334155' }}><Users size={14} style={{ color: '#0ea5e9' }} />작업자(Worker) 매칭</label>
                    <select value={formData.workerId} onChange={e => {
                      // systemUsers가 아닌 실제 workers 컬렉션 매핑
                      const user = workers.find(u => u.id === e.target.value);
                      setFormData({ ...formData, workerId: e.target.value, workerName: user?.name || '' });
                    }} required style={inputStyle}>
                      <option value="">작업자 선택</option>
                      {workers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-sm font-bold mb-2" style={{ color: '#334155' }}>
                      <span className="flex items-center gap-2"><Receipt size={14} style={{ color: '#0ea5e9' }} />정산 예정 금액</span>
                      <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer" style={{ color: '#f43f5e' }}>
                        <input type="checkbox" checked={formData.isVat} onChange={e => setFormData({ ...formData, isVat: e.target.checked })} className="w-3.5 h-3.5" style={{ accentColor: '#f43f5e' }} /> VAT 포함
                      </label>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.settlementAmount ? Number(formData.settlementAmount.toString().replace(/,/g, '')).toLocaleString() : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                          setFormData({ ...formData, settlementAmount: raw });
                        }}
                        placeholder="예: 500,000"
                        required
                        style={{ ...inputStyle, paddingRight: '36px', textAlign: 'right' }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">원</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-3" style={{ color: '#334155' }}>필수 촬영 단계 (AR 카메라 강제 모드)</label>
                  <div className="flex gap-4">
                    {[
                      { val: 'BEFORE_AFTER', title: '전 / 후', sub: '일반 청소·소독' },
                      { val: 'BEFORE_DURING_AFTER', title: '전 / 중 / 후', sub: '에어컨 분해·공사' },
                    ].map(opt => (
                      <label key={opt.val}
                        className="flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                        style={formData.photoReq === opt.val ? { background: 'linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.08))', border: '1.5px solid rgba(14,165,233,0.4)', boxShadow: '0 2px 8px rgba(14,165,233,0.15)' } : { background: 'rgba(248,250,252,0.8)', border: '1.5px solid rgba(14,165,233,0.12)' }}
                      >
                        <input type="radio" name="photo" checked={formData.photoReq === opt.val} onChange={() => setFormData({ ...formData, photoReq: opt.val })} className="w-5 h-5" style={{ accentColor: '#0ea5e9' }} />
                        <div>
                          <div className="font-bold text-sm" style={{ color: '#0f172a' }}>{opt.title}</div>
                          <div className="text-xs" style={{ color: '#64748b' }}>{opt.sub}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ── 작업 진행 상태 (수정 시에만 표시) ── */}
                {editingId && (
                  <div>
                    <label className="block text-sm font-bold mb-3" style={{ color: '#334155' }}>
                      🔄 작업 진행 상태
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { val: 'PENDING',     label: '대기 중',  emoji: '⏳', bg: '#f1f5f9', color: '#475569' },
                        { val: 'IN_PROGRESS', label: '진행 중',  emoji: '🔧', bg: '#dbeafe', color: '#1d4ed8' },
                        { val: 'COMPLETED',   label: '완료',     emoji: '✅', bg: '#dcfce7', color: '#166534' },
                        { val: 'REJECTED',    label: '반려',     emoji: '❌', bg: '#fee2e2', color: '#991b1b' },
                      ] as const).map(opt => (
                        <label key={opt.val}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer border-2 transition-all"
                          style={formData.status === opt.val
                            ? { background: opt.bg, borderColor: opt.color, boxShadow: `0 2px 10px ${opt.bg}` }
                            : { background: '#f8fafc', borderColor: 'rgba(14,165,233,0.15)' }
                          }
                        >
                          <input type="radio" name="status" className="sr-only"
                            checked={formData.status === opt.val}
                            onChange={() => setFormData({ ...formData, status: opt.val as Assignment['status'] })}
                          />
                          <span className="text-xl">{opt.emoji}</span>
                          <span className="text-xs font-bold" style={{ color: formData.status === opt.val ? opt.color : '#64748b' }}>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#334155' }}><Edit2 size={14} style={{ color: '#0ea5e9' }} />작업 내용 및 비고</label>
                  <textarea value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} placeholder="작업자에게 전달할 특이사항" rows={3} style={{ ...inputStyle, resize: 'none' }} />
                </div>
              </form>
            </div>

            <div className="px-8 py-5 flex justify-end gap-3" style={{ borderTop: '1.5px solid rgba(14,165,233,0.1)', background: 'rgba(248,250,252,0.5)' }}>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="px-6 py-3 rounded-xl font-bold transition-all"
                style={{ background: '#fff', color: '#64748b', border: '1.5px solid rgba(14,165,233,0.2)' }}>취소</button>
              <button type="submit" form="reg-form"
                className="px-8 py-3 text-white rounded-xl font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5"
                style={{ background: editingId ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 6px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                <CheckCircle2 size={20} /> {editingId ? '수정 저장' : '현장 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 구글 캘린더 Client ID 설정 모달 ── */}
      {isGCalSetupOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <h2 className="text-lg font-black flex items-center gap-2">📅 구글 캘린더 연동 설정</h2>
              <p className="text-blue-100 text-sm mt-1">Google Cloud Console에서 발급한 Client ID를 입력하세요.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-1">
                <p className="font-bold">📌 Client ID 발급 방법</p>
                <p>1. <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline font-bold">Google Cloud Console → 사용자 인증 정보</a> 접속</p>
                <p>2. OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션 선택)</p>
                <p>3. 승인된 JavaScript 원본에 현재 도메인 추가</p>
                <p>4. 생성된 클라이언트 ID 복사 후 아래 입력</p>
              </div>
              {gcalClientIdFromDB && (
                <p className="text-xs text-slate-500">현재 저장된 ID: <span className="font-mono text-slate-700">{gcalClientIdFromDB.substring(0, 30)}...</span></p>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Google Client ID</label>
                <input
                  type="text"
                  value={gcalClientInput}
                  onChange={e => setGcalClientInput(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full px-4 py-3 border-2 border-slate-200 focus:border-blue-400 rounded-xl outline-none text-sm font-mono"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsGCalSetupOpen(false)}
                  className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                  취소
                </button>
                <button onClick={handleSaveGcalClientId}
                  className="flex-1 py-3 font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:opacity-90 transition-all shadow-lg">
                  저장 후 연동 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
