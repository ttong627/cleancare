'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, Camera,
  Loader2, LogOut, Navigation, X, ChevronDown,
  MapPin, ImagePlus, Zap, User, List, Phone,
} from 'lucide-react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, storage } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import type { ProjectData } from '@/hooks/useProjects';

type PhotoType = 'before' | 'after' | 'process';
type Tab = 'list' | 'photo' | 'info';

const PHOTO_CONFIG: Record<PhotoType, { label: string; short: string; color: string }> = {
  before:  { label: '작업 전',  short: '전', color: '#0ea5e9' },
  process: { label: '작업 중',  short: '중', color: '#f59e0b' },
  after:   { label: '작업 후',  short: '후', color: '#10b981' },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:     { label: '대기',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)' },
  IN_PROGRESS: { label: '진행중', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',  border: 'rgba(56,189,248,0.3)' },
  COMPLETED:   { label: '완료',   color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.3)' },
  REJECTED:    { label: '긴급',   color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)' },
};

export default function MobilePage() {
  const [userName, setUserName]   = useState('작업자');
  const [userPhone, setUserPhone] = useState('');
  const [projects, setProjects]   = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'off' | 'searching' | 'active' | 'error'>('off');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [showDone, setShowDone]   = useState(false);
  const isGpsOn   = gpsStatus === 'active' || gpsStatus === 'searching';
  const watchId   = useRef<number | null>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const pendingUploadRef  = useRef<{ projectId: string; type: PhotoType } | null>(null);
  const lastGpsWrite      = useRef<number>(0);
  const uidRef            = useRef<string | null>(null);

  // 인증 & 프로필
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      uidRef.current = user.uid;
      const snap = await getDoc(doc(db, 'systemUsers', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setUserName(d.name ?? '작업자');
        setUserPhone(d.phone ?? '');
      }
    });
    return () => unsub();
  }, []);

  // 배정 현장 실시간 구독
  useEffect(() => {
    if (!userName || userName === '작업자') return;
    const q = query(collection(db, 'projects'), where('workerName', '==', userName));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectData));
      list.sort((a, b) => {
        const order: Record<string, number> = { REJECTED: 0, IN_PROGRESS: 1, PENDING: 2, COMPLETED: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9) || (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
      setProjects(list);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [userName]);

  // GPS
  const startGps = useCallback(() => {
    if (!navigator.geolocation) { toast.error('GPS를 지원하지 않는 기기입니다.'); return; }
    setGpsStatus('searching');
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentCoords({ lat, lng });
        setGpsStatus('active');
        const uid = uidRef.current;
        if (!uid) return;
        const now = Date.now();
        if (now - lastGpsWrite.current < 30_000) return;
        lastGpsWrite.current = now;
        try {
          await updateDoc(doc(db, 'systemUsers', uid), {
            currentLat: lat, currentLng: lng, locationUpdatedAt: now, isGpsActive: true,
          });
        } catch { /* 권한 오류 무시 */ }
      },
      () => {
        setGpsStatus('error');
        toast.error('위치 권한을 허용해주세요.');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
  }, []);

  const stopGps = useCallback(async () => {
    if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    setGpsStatus('off');
    setCurrentCoords(null);
    const uid = uidRef.current;
    if (uid) {
      try { await updateDoc(doc(db, 'systemUsers', uid), { isGpsActive: false, locationUpdatedAt: Date.now() }); }
      catch { /* ignore */ }
    }
  }, []);

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  // 사진 업로드
  const handlePhotoUpload = (projectId: string, type: PhotoType) => {
    pendingUploadRef.current = { projectId, type };
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingUploadRef.current) return;
    const { projectId, type } = pendingUploadRef.current;
    pendingUploadRef.current = null;
    setUploadingId(projectId);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `projects/${projectId}/${type}_${Date.now()}.${ext}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      const existing = (projSnap.data()?.photos ?? []) as ProjectData['photos'];
      await updateDoc(doc(db, 'projects', projectId), {
        photos: [...(existing ?? []), { url, type, uploadedAt: Date.now(), uploadedBy: userName, storagePath: path }],
      });
      toast.success('📸 사진 업로드 완료');
    } catch (err: unknown) {
      toast.error('업로드 실패: ' + (err instanceof Error ? err.message : '오류'));
    } finally {
      setUploadingId(null);
    }
  };

  // 상태 업데이트
  const handleStatusUpdate = async (projectId: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', reason?: string) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { status, rejectReason: reason ?? null, updatedAt: Date.now() });
      if (status === 'COMPLETED') toast.success('✅ 완료 보고 전송!');
      else if (status === 'REJECTED') toast.error('🚨 긴급 신고 전송됨');
      setSelectedProject(null);
    } catch {
      toast.error('상태 업데이트 실패');
    }
  };

  const handleLogout = async () => {
    await stopGps();
    await signOut(auth);
    window.location.href = '/login';
  };

  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'COMPLETED'), [projects]);
  const doneProjects   = useMemo(() => projects.filter(p => p.status === 'COMPLETED'),  [projects]);
  const rejectedCount  = useMemo(() => projects.filter(p => p.status === 'REJECTED').length, [projects]);

  // 전체 사진 목록 (사진 탭)
  const allPhotos = useMemo(() =>
    projects.flatMap(p => (p.photos ?? []).map(ph => ({ ...ph, projectName: p.name }))),
    [projects]
  );

  const gpsColor = { active: '#34d399', searching: '#fbbf24', error: '#f87171', off: '#475569' }[gpsStatus];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0f172a 0%,#1a2744 100%)', paddingBottom: 72 }}>
      <Toaster position="top-center" toastOptions={{ style: { fontSize: 14, fontWeight: 600 } }} />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 px-4 pt-safe-top" style={{ background: 'rgba(10,16,35,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between h-14">
          {/* 좌: 프로필 */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#818cf8)' }}>
              {userName[0]}
            </div>
            <div className="leading-none">
              <p className="text-white font-bold text-sm">{userName}</p>
              <p className="text-slate-500 text-xs mt-0.5">현장작업자</p>
            </div>
          </div>
          {/* 우: GPS + 로그아웃 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => isGpsOn ? stopGps() : startGps()}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold transition-all"
              style={{ background: `${gpsColor}18`, color: gpsColor, border: `1.5px solid ${gpsColor}50` }}
            >
              {gpsStatus === 'searching'
                ? <Loader2 size={12} className="animate-spin" />
                : <span className="w-2 h-2 rounded-full inline-block" style={{ background: gpsColor, boxShadow: isGpsOn ? `0 0 6px ${gpsColor}` : 'none' }} />
              }
              {gpsStatus === 'active' ? 'GPS 켜짐' : gpsStatus === 'searching' ? '연결중' : gpsStatus === 'error' ? '오류' : 'GPS'}
            </button>
            <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* GPS 좌표 바 */}
        {currentCoords && (
          <div className="pb-2 flex items-center gap-2 text-xs" style={{ color: '#34d399' }}>
            <Navigation size={11} />
            <span className="font-mono">{currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}</span>
            <span className="ml-auto text-slate-600 text-[10px]">관리자 공유 중</span>
          </div>
        )}
      </header>

      {/* ── 요약 스탯 바 ── */}
      <div className="flex gap-2 px-4 py-3">
        {[
          { label: '전체',   value: projects.length,           color: '#94a3b8' },
          { label: '진행',   value: activeProjects.length,     color: '#38bdf8' },
          { label: '긴급',   value: rejectedCount,             color: '#f87171' },
          { label: '완료',   value: doneProjects.length,       color: '#34d399' },
        ].map(s => (
          <div key={s.label} className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.color}20` }}>
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── 탭 컨텐츠 ── */}
      <div className="flex-1 px-4 pb-4">

        {/* 현장 목록 탭 */}
        {activeTab === 'list' && (
          <div className="space-y-3">

            {isLoading ? (
              [1,2,3].map(i => (
                <div key={i} className="h-36 rounded-3xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))
            ) : activeProjects.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: '#34d399', opacity: 0.3 }} />
                <p className="text-slate-500 text-sm">배정된 현장이 없습니다</p>
              </div>
            ) : (
              activeProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={() => setSelectedProject(project)}
                  onPhotoUpload={handlePhotoUpload}
                  onComplete={() => handleStatusUpdate(project.id, 'COMPLETED')}
                  isUploading={uploadingId === project.id}
                />
              ))
            )}

            {/* 완료 현장 접기/펼치기 */}
            {doneProjects.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowDone(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-colors"
                  style={{ background: 'rgba(52,211,153,0.06)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={15} /> 완료 현장 {doneProjects.length}건
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
                </button>
                {showDone && (
                  <div className="mt-2 space-y-2">
                    {doneProjects.map(project => (
                      <div key={project.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                        style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.1)' }}>
                        <CheckCircle2 size={16} style={{ color: '#34d399' }} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-300 truncate">{project.name}</p>
                          {project.address && <p className="text-xs text-slate-600 truncate mt-0.5">{project.address}</p>}
                        </div>
                        <span className="text-xs text-slate-600 shrink-0">
                          {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 사진 탭 */}
        {activeTab === 'photo' && (
          <div>
            {allPhotos.length === 0 ? (
              <div className="py-16 text-center">
                <ImagePlus size={48} className="mx-auto mb-3" style={{ color: '#38bdf8', opacity: 0.3 }} />
                <p className="text-slate-500 text-sm">업로드된 사진이 없습니다</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">총 {allPhotos.length}장</p>
                <div className="grid grid-cols-3 gap-2">
                  {allPhotos.map((ph, i) => (
                    <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-slate-800 relative">
                      <img src={ph.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-bold text-white truncate"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                        {ph.projectName}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 내정보 탭 */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* 프로필 카드 */}
            <div className="rounded-3xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl font-black text-white"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#818cf8)' }}>
                {userName[0]}
              </div>
              <h2 className="text-xl font-black text-white">{userName}</h2>
              <p className="text-slate-500 text-sm mt-1">현장 작업자</p>
              {userPhone && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Phone size={13} className="text-slate-500" />
                  <span className="text-slate-400 text-sm font-mono">{userPhone}</span>
                </div>
              )}
            </div>

            {/* GPS 상세 */}
            <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                <Navigation size={14} /> GPS 위치 공유
              </h3>
              <button
                onClick={() => isGpsOn ? stopGps() : startGps()}
                className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all"
                style={isGpsOn
                  ? { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1.5px solid rgba(248,113,113,0.3)' }
                  : { background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', boxShadow: '0 4px 20px rgba(14,165,233,0.35)' }
                }
              >
                {gpsStatus === 'searching'
                  ? <><Loader2 size={20} className="animate-spin" /> GPS 연결 중...</>
                  : isGpsOn
                  ? <><span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" /> GPS 끄기</>
                  : <><Navigation size={20} /> GPS 켜기 (관리자 공유)</>
                }
              </button>
              {currentCoords && (
                <div className="mt-3 px-4 py-3 rounded-2xl flex items-center gap-2" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <MapPin size={14} style={{ color: '#34d399' }} />
                  <span className="text-xs font-mono" style={{ color: '#34d399' }}>
                    {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            {/* 작업 통계 */}
            <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-sm font-bold text-slate-400 mb-4">내 작업 현황</h3>
              <div className="space-y-3">
                {[
                  { label: '진행 중',  value: activeProjects.filter(p => p.status === 'IN_PROGRESS').length, color: '#38bdf8' },
                  { label: '대기',     value: activeProjects.filter(p => p.status === 'PENDING').length,     color: '#fbbf24' },
                  { label: '긴급',     value: rejectedCount,                                                 color: '#f87171' },
                  { label: '완료',     value: doneProjects.length,                                           color: '#34d399' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-12">{s.label}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${projects.length ? (s.value / projects.length) * 100 : 0}%`, background: s.color }} />
                    </div>
                    <span className="text-sm font-black w-6 text-right" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 로그아웃 */}
            <button onClick={handleLogout}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        )}
      </div>

      {/* ── 하단 탭 바 ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 pb-safe-bottom"
        style={{ background: 'rgba(10,16,35,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex">
          {([
            { id: 'list',  label: '현장',  Icon: List,     badge: rejectedCount > 0 ? rejectedCount : 0 },
            { id: 'photo', label: '사진',  Icon: ImagePlus, badge: 0 },
            { id: 'info',  label: '내정보', Icon: User,     badge: 0 },
          ] as const).map(({ id, label, Icon, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-colors"
              style={{ color: activeTab === id ? '#38bdf8' : '#475569' }}>
              <div className="relative">
                <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 1.8} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[10px] font-black flex items-center justify-center"
                    style={{ background: '#f87171' }}>{badge}</span>
                )}
              </div>
              <span className="text-[10px] font-bold">{label}</span>
              {activeTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: '#38bdf8' }} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── 현장 상세 바텀 시트 ── */}
      {selectedProject && (
        <ProjectSheet
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onStatusUpdate={handleStatusUpdate}
          onPhotoUpload={handlePhotoUpload}
          isUploading={uploadingId === selectedProject.id}
          userName={userName}
        />
      )}
    </div>
  );
}

/* ══ 현장 카드 ══ */
function ProjectCard({ project, onSelect, onPhotoUpload, onComplete, isUploading }: {
  project: ProjectData;
  onSelect: () => void;
  onPhotoUpload: (id: string, type: PhotoType) => void;
  onComplete: () => void;
  isUploading: boolean;
}) {
  const cfg = STATUS_CFG[project.status] ?? STATUS_CFG['PENDING'];
  const photoCount = project.photos?.length ?? 0;
  const isRejected = project.status === 'REJECTED';
  const isDone     = project.status === 'COMPLETED';

  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: isRejected ? 'rgba(248,113,113,0.07)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${cfg.border}` }}>

      {/* 긴급 배너 */}
      {isRejected && (
        <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'rgba(248,113,113,0.2)' }}>
          <AlertCircle size={14} style={{ color: '#f87171' }} />
          <span className="text-xs font-black" style={{ color: '#f87171' }}>긴급 조치 필요</span>
          {project.rejectReason && (
            <span className="text-xs text-red-300 truncate ml-1">· {project.rejectReason}</span>
          )}
        </div>
      )}

      <div className="p-4">
        {/* 현장명 + 상태 */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              {photoCount > 0 && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Camera size={10} />{photoCount}
                </span>
              )}
            </div>
            <h3 className="font-black text-white text-base leading-tight">{project.name}</h3>
            {project.address && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                <MapPin size={10} className="shrink-0" />{project.address}
              </p>
            )}
          </div>
          {/* 상세 버튼 */}
          <button onClick={onSelect}
            className="w-10 h-10 flex items-center justify-center rounded-2xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#94a3b8' }}>
            <Zap size={17} />
          </button>
        </div>

        {/* 사진 업로드 버튼 */}
        {!isDone && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(Object.entries(PHOTO_CONFIG) as [PhotoType, typeof PHOTO_CONFIG[PhotoType]][]).map(([type, c]) => (
              <button key={type} onClick={() => onPhotoUpload(project.id, type)} disabled={isUploading}
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-bold disabled:opacity-40 transition-opacity"
                style={{ background: `${c.color}12`, color: c.color, border: `1px solid ${c.color}25` }}>
                {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                {c.short}
              </button>
            ))}
          </div>
        )}

        {/* 완료 버튼 (진행중/대기 현장만) */}
        {(project.status === 'IN_PROGRESS' || project.status === 'PENDING') && (
          <button onClick={onComplete}
            className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
            <CheckCircle2 size={17} /> 작업 완료 보고
          </button>
        )}

        {/* 긴급 시: 재개 버튼 */}
        {isRejected && (
          <button onClick={onSelect}
            className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1.5px solid rgba(248,113,113,0.3)' }}>
            <AlertCircle size={17} /> 상세 보기 / 반려 처리
          </button>
        )}
      </div>
    </div>
  );
}

/* ══ 현장 상세 바텀 시트 ══ */
function ProjectSheet({ project, onClose, onStatusUpdate, onPhotoUpload, isUploading, userName }: {
  project: ProjectData;
  onClose: () => void;
  onStatusUpdate: (id: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', reason?: string) => void;
  onPhotoUpload: (id: string, type: PhotoType) => void;
  isUploading: boolean;
  userName: string;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const cfg = STATUS_CFG[project.status] ?? STATUS_CFG['PENDING'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div
        className="rounded-t-[32px] flex flex-col"
        style={{ background: '#0f1c2e', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="overflow-y-auto px-5 pb-8 space-y-5">
          {/* 헤더 */}
          <div className="flex items-start justify-between pt-2">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full inline-block mb-2"
                style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              <h3 className="text-xl font-black text-white leading-tight">{project.name}</h3>
              {project.address && (
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                  <MapPin size={13} />{project.address}
                </p>
              )}
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full ml-3 shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#94a3b8' }}>
              <X size={18} />
            </button>
          </div>

          {/* 반려 사유 표시 */}
          {project.rejectReason && (
            <div className="px-4 py-3 rounded-2xl flex items-start gap-2"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
              <p className="text-sm font-medium" style={{ color: '#fca5a5' }}>{project.rejectReason}</p>
            </div>
          )}

          {/* 사진 업로드 */}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
              <Camera size={12} /> 사진 업로드
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(PHOTO_CONFIG) as [PhotoType, typeof PHOTO_CONFIG[PhotoType]][]).map(([type, c]) => (
                <button key={type} onClick={() => onPhotoUpload(project.id, type)} disabled={isUploading}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl font-bold text-sm disabled:opacity-40 transition-opacity"
                  style={{ background: `${c.color}12`, color: c.color, border: `1px solid ${c.color}25` }}>
                  {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 업로드된 사진 그리드 */}
          {(project.photos?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-3">{project.photos!.length}장 업로드됨</p>
              <div className="grid grid-cols-3 gap-2">
                {project.photos!.map((ph, i) => (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-slate-800">
                    <img src={ph.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상태 액션 */}
          <div className="space-y-3 pt-1">
            {project.status !== 'COMPLETED' && (
              <button
                onClick={() => onStatusUpdate(project.id, 'COMPLETED')}
                className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 6px 24px rgba(16,185,129,0.4)' }}>
                <CheckCircle2 size={22} /> 작업 완료 보고
              </button>
            )}

            {project.status === 'COMPLETED' && (
              <div className="py-4 rounded-2xl text-center font-bold text-sm"
                style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                ✅ 완료 처리된 현장입니다
              </div>
            )}

            {!showReject ? (
              <button onClick={() => setShowReject(true)}
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.18)' }}>
                <AlertCircle size={16} /> 반려 / 문제 신고
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="문제 발생 사유를 입력하세요..."
                  autoFocus
                  className="w-full px-4 py-3 rounded-2xl text-sm text-white resize-none"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', outline: 'none', minHeight: 90 }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowReject(false)}
                    className="py-3.5 rounded-2xl text-sm font-bold text-slate-400"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    취소
                  </button>
                  <button onClick={() => onStatusUpdate(project.id, 'REJECTED', rejectReason)}
                    className="py-3.5 rounded-2xl text-sm font-black text-white"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                    신고 전송
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-700 pb-1">작업자: {userName}</p>
        </div>
      </div>
    </div>
  );
}
