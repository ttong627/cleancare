'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { ProjectData } from '@/hooks/useProjects';
import {
  Camera, Search, Download, Trash2, Archive, Image as ImageIcon,
  CheckSquare, Square, Loader2, X, Smartphone, Monitor, ZoomIn,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

type DisplayType = 'before' | 'during' | 'after' | 'extra';
type FilterTab   = 'all' | DisplayType;

const TYPE_LABEL: Record<DisplayType, string> = {
  before: '작업 전', during: '작업 중', after: '작업 후', extra: '추가 촬영',
};
const TYPE_KR: Record<DisplayType, string> = {
  before: '작업전', during: '작업중', after: '작업후', extra: '추가촬영',
};
const TYPE_COLORS: Record<DisplayType, { bg: string; text: string; border: string }> = {
  before: { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  during: { bg: 'rgba(245,158,11,0.1)', text: '#d97706', border: 'rgba(245,158,11,0.3)' },
  after:  { bg: 'rgba(16,185,129,0.1)', text: '#059669', border: 'rgba(16,185,129,0.3)' },
  extra:  { bg: 'rgba(99,102,241,0.1)', text: '#6366f1', border: 'rgba(99,102,241,0.3)' },
};
const TAB_LABELS: Record<FilterTab, string> = {
  all: '전체', before: '작업 전', during: '작업 중', after: '작업 후', extra: '추가 촬영',
};

interface DisplayPhoto {
  id: string;
  url: string;
  type: DisplayType;
  spotName?: string;
  timestamp: number;
  source: 'ar' | 'extra' | 'pc';
  storagePath?: string;       // only for deletable PC photos
  originalPcPhoto?: object;   // exact Firestore object for arrayRemove
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPhotos(project: ProjectData): DisplayPhoto[] {
  const result: DisplayPhoto[] = [];

  // AR spot photos (mobile)
  Object.entries(project.arSpots || {}).forEach(([id, spot]) => {
    const ts = spot.startedAt || project.createdAt || 0;
    if (spot.beforeUrl) result.push({ id: `ar_before_${id}`, url: spot.beforeUrl, type: 'before', spotName: spot.name, timestamp: ts, source: 'ar' });
    if (spot.duringUrl) result.push({ id: `ar_during_${id}`, url: spot.duringUrl, type: 'during', spotName: spot.name, timestamp: ts, source: 'ar' });
    if (spot.afterUrl)  result.push({ id: `ar_after_${id}`,  url: spot.afterUrl,  type: 'after',  spotName: spot.name, timestamp: spot.completedAt || ts, source: 'ar' });
    (spot.extraPhotos || []).filter(ep => ep.url).forEach(ep =>
      result.push({ id: `ar_extra_${ep.id}`, url: ep.url!, type: 'extra', spotName: spot.name, timestamp: ep.capturedAt || ts, source: 'extra' })
    );
  });

  // PC-uploaded photos
  (project.photos || []).forEach((ph, i) => {
    const type: DisplayType = ph.type === 'process' ? 'during' : ph.type as DisplayType;
    result.push({
      id: `pc_${ph.storagePath || i}`, url: ph.url, type,
      spotName: ph.arSpotName, timestamp: ph.uploadedAt, source: 'pc',
      storagePath: ph.storagePath, originalPcPhoto: ph as object,
    });
  });

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

function makeFilename(projectName: string, photo: DisplayPhoto, seq: number): string {
  const date = new Date(photo.timestamp || Date.now()).toISOString().slice(0, 10);
  const safe = projectName.replace(/[\\/:*?"<>|]/g, '_');
  return `${safe}_${date}_${TYPE_KR[photo.type]}_${String(seq).padStart(3, '0')}.jpg`;
}

function countPhotos(project: ProjectData): number {
  let cnt = project.photos?.length ?? 0;
  Object.values(project.arSpots || {}).forEach(spot => {
    if (spot.beforeUrl) cnt++;
    if (spot.duringUrl) cnt++;
    if (spot.afterUrl)  cnt++;
    cnt += (spot.extraPhotos || []).filter(ep => ep.url).length;
  });
  return cnt;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhotosPage() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'MASTER' || userData?.role === 'ADMIN';

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectData));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProjects(data);
      setIsLoading(false);
      setSelectedProject(prev => prev ? (data.find(p => p.id === prev.id) ?? null) : null);
    });
    return () => unsub();
  }, []);

  const allPhotos    = useMemo(() => selectedProject ? buildPhotos(selectedProject) : [], [selectedProject]);
  const displayed    = useMemo(() => activeTab === 'all' ? allPhotos : allPhotos.filter(p => p.type === activeTab), [allPhotos, activeTab]);
  const typeCounts   = useMemo(() => {
    const c: Record<FilterTab, number> = { all: allPhotos.length, before: 0, during: 0, after: 0, extra: 0 };
    allPhotos.forEach(p => c[p.type]++);
    return c;
  }, [allPhotos]);
  const filtered = useMemo(() => projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.workerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  ), [projects, searchQuery]);

  const lightboxPhoto = lightboxIdx !== null ? displayed[lightboxIdx] : null;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const openLightbox = (photo: DisplayPhoto) => {
    const idx = displayed.findIndex(p => p.id === photo.id);
    setLightboxIdx(idx);
  };

  const moveLightbox = (dir: 1 | -1) => {
    setLightboxIdx(prev => {
      if (prev === null) return null;
      const next = prev + dir;
      return next >= 0 && next < displayed.length ? next : prev;
    });
  };

  const downloadPhoto = async (photo: DisplayPhoto, seq: number) => {
    const name = makeFilename(selectedProject!.name, photo, seq);
    try {
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      const a = document.createElement('a');
      a.href = photo.url;
      a.download = name;
      a.target = '_blank';
      a.click();
    }
  };

  const downloadZip = async () => {
    const photos = displayed.filter(p => selectedIds.has(p.id));
    if (!photos.length) return;
    setIsDownloadingZip(true);
    const toastId = toast.loading(`${photos.length}장 ZIP 압축 중...`);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const safe = selectedProject!.name.replace(/[\\/:*?"<>|]/g, '_');
      const folder = zip.folder(safe)!;
      let failed = 0;
      await Promise.all(photos.map(async (photo, i) => {
        try {
          const res = await fetch(photo.url);
          const blob = await res.blob();
          folder.file(makeFilename(selectedProject!.name, photo, i + 1), blob);
        } catch { failed++; }
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `${safe}_사진_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`ZIP 저장 완료${failed ? ` (${failed}장 실패)` : ''}`, { id: toastId });
    } catch { toast.error('ZIP 생성 중 오류', { id: toastId }); }
    finally { setIsDownloadingZip(false); }
  };

  const deletePhoto = async (photo: DisplayPhoto) => {
    if (!isAdmin || !photo.storagePath || !selectedProject) return;
    if (!confirm('이 사진을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.')) return;
    setDeletingId(photo.id);
    try {
      await deleteObject(ref(storage, photo.storagePath));
      await updateDoc(doc(db, 'projects', selectedProject.id), { photos: arrayRemove(photo.originalPcPhoto) });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(photo.id); return n; });
      toast.success('삭제되었습니다.');
    } catch (e: any) { toast.error('삭제 실패: ' + e.message); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 mb-2" style={{ color: '#0f172a' }}>
          <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 16px rgba(14,165,233,0.4)' }}>
            <Camera className="text-white" size={24} />
          </div>
          현장 사진 관리
        </h1>
        <p className="ml-14 font-medium" style={{ color: '#64748b' }}>
          모바일 AR 촬영 + 추가 작업사진 + PC 업로드 사진을 통합 관리합니다.
        </p>
      </header>

      <div className="flex gap-6 flex-1" style={{ minHeight: 0 }}>
        {/* ── Left: project list ── */}
        <div className="w-72 shrink-0 flex flex-col rounded-3xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(14,165,233,0.15)', boxShadow: '0 8px 32px rgba(14,165,233,0.1)' }}>
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text" placeholder="현장명, 작업자 검색..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-400"
                style={{ background: 'rgba(241,245,249,0.9)', border: '1px solid rgba(14,165,233,0.15)', color: '#0f172a' }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-sky-500" size={32} /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-slate-400 mt-10 text-sm">현장이 없습니다.</p>
            ) : filtered.map(project => {
              const isActive = selectedProject?.id === project.id;
              const count = countPhotos(project);
              const spotCount = Object.keys(project.arSpots || {}).length;
              return (
                <button key={project.id}
                  onClick={() => { setSelectedProject(project); setSelectedIds(new Set()); setActiveTab('all'); }}
                  className="w-full text-left p-3 rounded-2xl transition-all"
                  style={isActive ? {
                    background: 'linear-gradient(135deg,rgba(14,165,233,0.15),rgba(99,102,241,0.12))',
                    border: '1px solid rgba(14,165,233,0.35)', boxShadow: '0 4px 12px rgba(14,165,233,0.15)',
                  } : { background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.8)' }}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm truncate" style={{ color: isActive ? '#0369a1' : '#0f172a' }}>{project.name}</span>
                    <span className="shrink-0 ml-1 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={count > 0 ? { background: 'rgba(14,165,233,0.1)', color: '#0369a1' } : { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                      {count}장
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs" style={{ color: '#64748b' }}>{project.workerName || '미배정'}</p>
                    {spotCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}>
                        {spotCount}스팟
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: photo grid ── */}
        <div className="flex-1 flex flex-col rounded-3xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(14,165,233,0.15)', boxShadow: '0 8px 32px rgba(14,165,233,0.1)' }}>
          {selectedProject ? (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h2 className="font-bold text-base" style={{ color: '#0f172a' }}>{selectedProject.name}</h2>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      전체 {allPhotos.length}장
                      {selectedIds.size > 0 && <span className="ml-2 font-bold" style={{ color: '#6366f1' }}>{selectedIds.size}장 선택</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {displayed.length > 0 && (
                      <button
                        onClick={selectedIds.size === displayed.length ? () => setSelectedIds(new Set()) : () => setSelectedIds(new Set(displayed.map(p => p.id)))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}
                      >
                        {selectedIds.size === displayed.length ? <CheckSquare size={14} /> : <Square size={14} />}
                        {selectedIds.size === displayed.length ? '전체 해제' : '전체 선택'}
                      </button>
                    )}
                    {selectedIds.size > 0 && (
                      <button onClick={downloadZip} disabled={isDownloadingZip}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}>
                        {isDownloadingZip ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        ZIP 다운로드 ({selectedIds.size}장)
                      </button>
                    )}
                  </div>
                </div>

                {/* Type filter tabs */}
                <div className="flex gap-1 p-1 rounded-xl flex-wrap"
                  style={{ background: 'rgba(241,245,249,0.9)', border: '1px solid rgba(226,232,240,0.8)' }}>
                  {(Object.keys(TAB_LABELS) as FilterTab[]).map(tab => (
                    <button key={tab}
                      onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={activeTab === tab
                        ? { background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', boxShadow: '0 2px 8px rgba(14,165,233,0.25)' }
                        : { color: '#64748b' }}>
                      {TAB_LABELS[tab]}
                      {typeCounts[tab] > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                          style={activeTab === tab ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { background: 'rgba(148,163,184,0.2)', color: '#64748b' }}>
                          {typeCounts[tab]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {displayed.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={64} className="mb-4 opacity-20" />
                    <p className="font-medium">이 탭에 사진이 없습니다.</p>
                    {activeTab !== 'all' && (
                      <p className="text-sm mt-1">모바일 AR 촬영 후 사진이 여기에 표시됩니다.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {displayed.map((photo, i) => {
                      const isSelected = selectedIds.has(photo.id);
                      const tc = TYPE_COLORS[photo.type];
                      return (
                        <div key={photo.id}
                          className="relative group rounded-2xl overflow-hidden cursor-pointer transition-all"
                          style={{
                            aspectRatio: '1',
                            border: isSelected ? '2.5px solid #6366f1' : '1.5px solid rgba(226,232,240,0.8)',
                            boxShadow: isSelected ? '0 4px 16px rgba(99,102,241,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
                          }}
                          onClick={() => toggleSelect(photo.id)}
                        >
                          <img src={photo.url} alt={photo.spotName || photo.type}
                            className="w-full h-full object-cover" loading="lazy"
                            onClick={e => { e.stopPropagation(); openLightbox(photo); }}
                          />

                          {/* Checkbox */}
                          <div className="absolute top-2 left-2">
                            <div className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={{ background: isSelected ? '#6366f1' : 'rgba(255,255,255,0.9)', border: isSelected ? 'none' : '1.5px solid rgba(99,102,241,0.4)' }}>
                              {isSelected && <CheckSquare size={12} className="text-white" />}
                            </div>
                          </div>

                          {/* Type badge */}
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                              style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                              {TYPE_LABEL[photo.type]}
                            </span>
                            {/* Source badge */}
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-0.5"
                              style={photo.source === 'pc'
                                ? { background: 'rgba(16,185,129,0.15)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }
                                : { background: 'rgba(14,165,233,0.15)', color: '#0284c7', border: '1px solid rgba(14,165,233,0.25)' }}>
                              {photo.source === 'pc' ? <><Monitor size={9} /> PC</> : <><Smartphone size={9} /> AR</>}
                            </span>
                          </div>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center gap-1.5 p-2"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)' }}>
                            <button onClick={e => { e.stopPropagation(); openLightbox(photo); }}
                              className="p-1.5 rounded-lg text-white hover:scale-110 transition-all"
                              style={{ background: 'rgba(99,102,241,0.9)' }} title="크게 보기">
                              <ZoomIn size={14} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); downloadPhoto(photo, i + 1); }}
                              className="p-1.5 rounded-lg text-white hover:scale-110 transition-all"
                              style={{ background: 'rgba(14,165,233,0.9)' }} title="다운로드">
                              <Download size={14} />
                            </button>
                            {isAdmin && photo.storagePath && (
                              <button onClick={e => { e.stopPropagation(); deletePhoto(photo); }}
                                disabled={deletingId === photo.id}
                                className="p-1.5 rounded-lg text-white hover:scale-110 transition-all disabled:opacity-60"
                                style={{ background: 'rgba(239,68,68,0.9)' }} title="삭제 (PC 업로드만)">
                                {deletingId === photo.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            )}
                          </div>

                          {/* Spot name */}
                          {photo.spotName && (
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-bold text-white truncate"
                              style={{ background: 'rgba(0,0,0,0.6)' }}>
                              {photo.spotName}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Camera size={64} className="mb-4 opacity-20" />
              <p className="font-medium">왼쪽에서 현장을 선택해주세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxPhoto && lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.93)' }}
          onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-xl text-white hover:bg-white/10 z-10"
            onClick={() => setLightboxIdx(null)}>
            <X size={24} />
          </button>

          {lightboxIdx > 0 && (
            <button className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-2xl text-white z-10 transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.12)' }}
              onClick={e => { e.stopPropagation(); moveLightbox(-1); }}>
              <ChevronLeft size={28} />
            </button>
          )}
          {lightboxIdx < displayed.length - 1 && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-2xl text-white z-10 transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.12)' }}
              onClick={e => { e.stopPropagation(); moveLightbox(1); }}>
              <ChevronRight size={28} />
            </button>
          )}

          <img src={lightboxPhoto.url} alt="원본 사진"
            className="rounded-2xl shadow-2xl"
            style={{ maxHeight: '84vh', maxWidth: '88vw', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />

          {/* Bottom info + download */}
          <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center gap-3 px-4 flex-wrap"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
              <span className="px-2 py-0.5 rounded text-xs font-bold"
                style={{ background: TYPE_COLORS[lightboxPhoto.type].bg, color: TYPE_COLORS[lightboxPhoto.type].text }}>
                {TYPE_LABEL[lightboxPhoto.type]}
              </span>
              {lightboxPhoto.spotName && <span>{lightboxPhoto.spotName}</span>}
              <span className="text-slate-400 text-xs">{lightboxIdx + 1} / {displayed.length}</span>
            </div>
            <button onClick={() => downloadPhoto(lightboxPhoto, lightboxIdx + 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'rgba(14,165,233,0.9)' }}>
              <Download size={16} /> 다운로드
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
