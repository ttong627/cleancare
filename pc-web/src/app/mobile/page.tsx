'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Navigation, CheckCircle2, AlertCircle, Clock, Camera,
  Upload, Loader2, LogOut, User, Wifi, WifiOff, ChevronRight, X,
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: '대기 중',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  IN_PROGRESS: { label: '진행 중',   color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  COMPLETED:   { label: '완료됨',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  REJECTED:    { label: '긴급 조치', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function MobilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [userName, setUserName] = useState('작업자');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGpsOn, setIsGpsOn] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'off' | 'searching' | 'active' | 'error'>('off');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const watchId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ projectId: string; type: PhotoType } | null>(null);

  // 인증 상태
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      setUid(user.uid);
      const snap = await getDoc(doc(db, 'systemUsers', user.uid));
      if (snap.exists()) setUserName(snap.data().name ?? '작업자');
    });
    return () => unsub();
  }, []);

  // 내 배정 현장 구독
  useEffect(() => {
    if (!userName || userName === '작업자') return;
    const q = query(collection(db, 'projects'), where('workerName', '==', userName));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectData));
      list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setProjects(list);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [userName]);

  // GPS 위치 추적 토글
  const startGps = useCallback(() => {
    if (!navigator.geolocation) { toast.error('이 기기는 GPS를 지원하지 않습니다.'); return; }
    setGpsStatus('searching');
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentCoords({ lat, lng });
        setGpsStatus('active');
        if (uid) {
          try {
            await updateDoc(doc(db, 'systemUsers', uid), {
              currentLat: lat,
              currentLng: lng,
              locationUpdatedAt: Date.now(),
              isGpsActive: true,
            });
          } catch { /* 권한 오류 무시 */ }
        }
      },
      (err) => {
        console.error('GPS 오류:', err);
        setGpsStatus('error');
        toast.error('GPS 위치를 가져올 수 없습니다. 위치 권한을 허용해주세요.');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
  }, [uid]);

  const stopGps = useCallback(async () => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setGpsStatus('off');
    setCurrentCoords(null);
    if (uid) {
      try {
        await updateDoc(doc(db, 'systemUsers', uid), {
          isGpsActive: false,
          locationUpdatedAt: Date.now(),
        });
      } catch { /* ignore */ }
    }
  }, [uid]);

  const handleGpsToggle = () => {
    if (isGpsOn) {
      setIsGpsOn(false);
      stopGps();
    } else {
      setIsGpsOn(true);
      startGps();
    }
  };

  // GPS 종료 시 cleanup
  useEffect(() => {
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

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
      toast.success('사진이 업로드되었습니다.');
    } catch (err: unknown) {
      toast.error('사진 업로드 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingId(null);
    }
  };

  const handleStatusUpdate = async (projectId: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', reason?: string) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status,
        rejectReason: reason ?? null,
        updatedAt: Date.now(),
      });
      toast.success(status === 'COMPLETED' ? '완료 보고가 전송되었습니다.' : '상태가 업데이트되었습니다.');
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

  const gpsColor = gpsStatus === 'active' ? '#10b981' : gpsStatus === 'searching' ? '#f59e0b' : gpsStatus === 'error' ? '#ef4444' : '#64748b';
  const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PENDING');
  const doneProjects = projects.filter(p => p.status === 'COMPLETED' || p.status === 'REJECTED');

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' }}>
      <Toaster position="top-center" />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      {/* 상단 헤더 */}
      <header className="sticky top-0 z-20 px-4 py-4" style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
              {userName[0]}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{userName}</p>
              <p className="text-slate-400 text-xs">현장작업자</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* GPS 토글 */}
            <button
              onClick={handleGpsToggle}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: isGpsOn ? `${gpsColor}20` : 'rgba(255,255,255,0.06)', color: gpsColor, border: `1px solid ${gpsColor}40` }}
            >
              {gpsStatus === 'searching' ? <Loader2 size={14} className="animate-spin" /> :
               isGpsOn ? <Wifi size={14} /> : <WifiOff size={14} />}
              {gpsStatus === 'searching' ? 'GPS 연결중' : gpsStatus === 'active' ? 'GPS 활성' : gpsStatus === 'error' ? 'GPS 오류' : 'GPS 꺼짐'}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* GPS 좌표 표시 */}
        {currentCoords && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Navigation size={12} style={{ color: '#10b981' }} />
            <span style={{ color: '#10b981' }} className="font-mono">
              {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
            </span>
            <span className="ml-auto text-slate-500">관리자에게 공유 중</span>
          </div>
        )}
      </header>

      <div className="p-4 space-y-6">

        {/* 진행 중 현장 */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Clock size={14} /> 진행 중인 현장 ({activeProjects.length})
          </h2>
          {isLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />)}</div>
          ) : activeProjects.length === 0 ? (
            <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" style={{ color: '#10b981' }} />
              <p className="text-slate-500 text-sm">배정된 진행 현장이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={() => setSelectedProject(project)}
                  onPhotoUpload={handlePhotoUpload}
                  isUploading={uploadingId === project.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* 완료/긴급 현장 */}
        {doneProjects.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <CheckCircle2 size={14} /> 완료 / 긴급 현장
            </h2>
            <div className="space-y-2">
              {doneProjects.slice(0, 5).map(project => (
                <div key={project.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_LABELS[project.status]?.color ?? '#64748b' }} />
                  <span className="text-sm text-slate-300 flex-1 truncate">{project.name}</span>
                  <span className="text-xs" style={{ color: STATUS_LABELS[project.status]?.color ?? '#64748b' }}>
                    {STATUS_LABELS[project.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 현장 상세/액션 모달 */}
      {selectedProject && (
        <ProjectActionModal
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

function ProjectCard({ project, onSelect, onPhotoUpload, isUploading }: {
  project: ProjectData;
  onSelect: () => void;
  onPhotoUpload: (id: string, type: PhotoType) => void;
  isUploading: boolean;
}) {
  const st = STATUS_LABELS[project.status] ?? STATUS_LABELS['PENDING'];
  const photoCount = project.photos?.length ?? 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${st.color}30` }}>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              {photoCount > 0 && <span className="text-xs text-slate-500">{photoCount}장</span>}
            </div>
            <h3 className="font-bold text-white text-base truncate">{project.name}</h3>
            {project.address && <p className="text-xs text-slate-400 mt-0.5 truncate">{project.address}</p>}
          </div>
          <button onClick={onSelect} className="p-2 rounded-xl ml-2 shrink-0" style={{ background: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 사진 업로드 버튼 */}
        <div className="flex gap-2 mt-3">
          {(['before', 'process', 'after'] as PhotoType[]).map(type => {
            const labels = { before: '전', process: '중', after: '후' };
            const colors = { before: '#0ea5e9', process: '#f59e0b', after: '#10b981' };
            return (
              <button
                key={type}
                onClick={() => onPhotoUpload(project.id, type)}
                disabled={isUploading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                style={{ background: `${colors[type]}12`, color: colors[type], border: `1px solid ${colors[type]}30` }}
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                작업{labels[type]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectActionModal({ project, onClose, onStatusUpdate, onPhotoUpload, isUploading, userName }: {
  project: ProjectData;
  onClose: () => void;
  onStatusUpdate: (id: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', reason?: string) => void;
  onPhotoUpload: (id: string, type: PhotoType) => void;
  isUploading: boolean;
  userName: string;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl p-6 space-y-5"
        style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.2)' }} />

        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{project.name}</h3>
            <p className="text-slate-400 text-sm mt-0.5">{project.address ?? '주소 없음'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* 사진 업로드 */}
        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">사진 업로드</p>
          <div className="grid grid-cols-3 gap-2">
            {([['before', '작업 전', '#0ea5e9'], ['process', '작업 중', '#f59e0b'], ['after', '작업 후', '#10b981']] as [PhotoType, string, string][]).map(([type, label, color]) => (
              <button
                key={type}
                onClick={() => onPhotoUpload(project.id, type)}
                disabled={isUploading}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 기존 사진 목록 */}
        {(project.photos?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">업로드된 사진 ({project.photos!.length}장)</p>
            <div className="grid grid-cols-3 gap-2">
              {project.photos!.map((photo, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-800">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상태 업데이트 */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400">상태 업데이트</p>
          {project.status !== 'COMPLETED' && (
            <button
              onClick={() => onStatusUpdate(project.id, 'COMPLETED')}
              className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}
            >
              <CheckCircle2 size={20} /> 작업 완료 보고
            </button>
          )}

          {!showRejectInput ? (
            <button
              onClick={() => setShowRejectInput(true)}
              className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle size={16} /> 반려 / 문제 발생 신고
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="반려 또는 문제 사유를 입력하세요..."
                className="w-full px-4 py-3 rounded-xl text-sm text-white resize-none"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', outline: 'none', minHeight: 80 }}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowRejectInput(false)} className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-300" style={{ background: 'rgba(255,255,255,0.06)' }}>취소</button>
                <button
                  onClick={() => onStatusUpdate(project.id, 'REJECTED', rejectReason)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}
                >
                  신고 전송
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 작업자 서명 */}
        <p className="text-center text-xs text-slate-600">작업자: {userName}</p>
      </div>
    </div>
  );
}
