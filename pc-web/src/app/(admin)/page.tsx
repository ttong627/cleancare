'use client';

import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, RefreshCcw, Loader2, Search, X, Cloud, Sun, CloudRain } from 'lucide-react';
import { useProjects, useUpdateProjectStatus, ProjectData } from '@/hooks/useProjects';
import { useWorkerLocations } from '@/hooks/useWorkerLocations';
import ProjectDetailsModal from '@/components/ProjectDetailsModal';
import { Map, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';

const CardStyle = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(14,165,233,0.15), 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
};

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();
  const { mutate: updateStatus, isPending } = useUpdateProjectStatus();
  const workerLocations = useWorkerLocations();

  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_APP_KEY ?? '',
  });

  // 에러 로깅 (브라우저 콘솔에서 확인 가능)
  if (error) console.error('[카카오맵 SDK 로딩 실패]', error);

  const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string } | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
        if (!apiKey) return;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=37.5665&lon=126.9780&units=metric&lang=kr&appid=${apiKey}`);
        const data = await res.json();
        if (data.main) {
          setWeather({ temp: Math.round(data.main.temp), desc: data.weather[0].description, icon: data.weather[0].main });
        }
      } catch (err) { console.error('날씨 정보 연동 실패:', err); }
    }
    fetchWeather();
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.workerName.toLowerCase().includes(q) || (p.rejectReason ?? '').toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const rejectedCount   = projects?.filter(p => p.status === 'REJECTED').length ?? 0;
  const inProgressCount = projects?.filter(p => p.status === 'IN_PROGRESS').length ?? 0;
  const completedCount  = projects?.filter(p => p.status === 'COMPLETED').length ?? 0;
  const rejectedProjects   = filtered.filter(p => p.status === 'REJECTED');
  const inProgressProjects = filtered.filter(p => p.status === 'IN_PROGRESS');

  const SkeletonRow = () => (
    <div className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(14,165,233,0.08)' }} />
  );

  const getMockCoords = (index: number) => ({
    lat: 37.3827 + (index * 0.02 * (index % 2 === 0 ? 1 : -1)),
    lng: 127.1189 + (index * 0.03 * (index % 3 === 0 ? 1 : -1)),
  });

  const statCards = [
    { label: '긴급 조치 요망', count: rejectedCount,   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)',    icon: <AlertCircle size={28} /> },
    { label: '작업 진행 중',   count: inProgressCount, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',   border: 'rgba(14,165,233,0.2)',   icon: <Clock size={28} /> },
    { label: '오늘 완료된 작업', count: completedCount, color: '#10b981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.2)',   icon: <CheckCircle2 size={28} /> },
  ];

  return (
    <div className="p-8 min-h-screen">
      <ProjectDetailsModal project={selectedProject} isOpen={!!selectedProject} onClose={() => setSelectedProject(null)} />

      {/* 헤더 */}
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 mb-1" style={{ color: '#0f172a' }}>
            <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 16px rgba(14,165,233,0.4)' }}>
              <Navigation className="text-white" size={24} />
            </div>
            크린케어 통합 관제센터
          </h1>
          <p style={{ color: '#64748b' }} className="ml-14 font-medium">전국 현장 실시간 모니터링 — Exception-First 방식</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 뷰 토글 */}
          <div className="flex p-1 rounded-xl gap-1" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 2px 8px rgba(14,165,233,0.1)' }}>
            {[{ label: '리스트 뷰', val: 'list' as const }, { label: '지도 관제', val: 'map' as const }].map(v => (
              <button key={v.val} onClick={() => setViewMode(v.val)}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                style={viewMode === v.val ? { background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' } : { color: '#475569' }}
              >{v.label}</button>
            ))}
          </div>

          {isLoading && <div className="flex items-center gap-2" style={{ color: '#0ea5e9' }}><Loader2 className="animate-spin" size={20} /><span className="text-sm font-semibold">동기화 중...</span></div>}

          {weather && (
            <div className="px-4 py-2 rounded-full flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 2px 8px rgba(14,165,233,0.1)' }}>
              {weather.icon === 'Clear' ? <Sun size={18} style={{ color: '#f59e0b' }} /> : weather.icon === 'Rain' ? <CloudRain size={18} style={{ color: '#0ea5e9' }} /> : <Cloud size={18} style={{ color: '#64748b' }} />}
              <span className="text-sm font-semibold" style={{ color: '#334155' }}>{weather.temp}°C {weather.desc}</span>
            </div>
          )}

          <div className="px-4 py-2 rounded-full flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 2px 8px rgba(16,185,129,0.15)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
            <span className="text-sm font-bold" style={{ color: '#059669' }}>DB Live</span>
          </div>

          {/* DB 전체 삭제 버튼 */}
          <button
            onClick={async () => {
              if (!window.confirm('정말 모든 현장/정산/고객 DB 데이터를 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.')) return;
              try {
                const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');
                const toast = (await import('react-hot-toast')).default;
                toast.loading('DB 삭제 중...', { id: 'db-reset' });
                const collections = ['projects', 'invoices', 'assignments', 'clients', 'managers'];
                for (const colName of collections) {
                  const q = collection(db, colName);
                  const snapshot = await getDocs(q);
                  const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, colName, d.id)));
                  await Promise.all(deletePromises);
                }
                toast.success('DB 전체 초기화 완료', { id: 'db-reset' });
                window.location.reload();
              } catch (e: any) { alert('DB 삭제 실패: ' + e.message); }
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <X size={16} /> DB 전체 삭제
          </button>
        </div>
      </header>

      {/* 상태 요약 카드 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {statCards.map(({ label, count, color, bg, border, icon }) => (
          <div key={label} className="p-6 rounded-2xl transition-all hover:-translate-y-1" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: `1px solid ${border}`, boxShadow: `0 8px 32px ${bg.replace('0.08', '0.18')}, 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)` }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold mb-1 text-sm" style={{ color }}>{label}</p>
                <h2 className="text-4xl font-black" style={{ color: '#0f172a' }}>
                  {isLoading ? <span className="animate-pulse inline-block w-12 h-10 rounded-lg" style={{ background: bg }} /> : <>{count}<span className="text-lg font-semibold ml-1" style={{ color: '#94a3b8' }}>건</span></>}
                </h2>
              </div>
              <div className="p-3 rounded-xl" style={{ background: `linear-gradient(135deg, ${color}22, ${color}11)`, color, border: `1px solid ${color}33` }}>{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 바 */}
      {viewMode === 'list' && (
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="현장명, 작업자, 반려 사유 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl pl-12 pr-12 py-4 text-sm font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(14,165,233,0.2)', color: '#0f172a', boxShadow: '0 4px 16px rgba(14,165,233,0.1)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#94a3b8' }}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {viewMode === 'map' ? (
        <section className="h-[600px] w-full rounded-3xl overflow-hidden relative" style={{ ...CardStyle }}>
          {!process.env.NEXT_PUBLIC_KAKAO_APP_KEY ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: 'rgba(240,249,255,0.9)' }}>
              <MapPin size={48} style={{ color: '#0ea5e9' }} className="mb-4 animate-bounce" />
              <h2 className="text-2xl font-black mb-2" style={{ color: '#0f172a' }}>카카오맵 API 연동 완료</h2>
              <p className="text-sm font-medium" style={{ color: '#64748b' }}>.env.local에 NEXT_PUBLIC_KAKAO_APP_KEY를 입력하시면 실제 지도가 렌더링됩니다.</p>
            </div>
          ) : loading ? (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(240,249,255,0.9)' }}>
              <Loader2 className="animate-spin" size={48} style={{ color: '#0ea5e9' }} />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8" style={{ background: 'rgba(240,249,255,0.97)' }}>
              <div className="w-full max-w-lg p-6 rounded-2xl" style={{ background: '#fff', border: '1.5px solid rgba(239,68,68,0.25)', boxShadow: '0 8px 24px rgba(239,68,68,0.1)' }}>
                <h3 className="text-lg font-black mb-2 flex items-center gap-2" style={{ color: '#ef4444' }}>
                  ⚠️ 카카오맵 SDK 로딩 실패
                </h3>
                <div className="p-3 rounded-xl mb-4 font-mono text-xs" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.15)' }}>
                  {error instanceof Error ? error.message : String(error)}
                </div>
                <p className="text-sm font-bold mb-3" style={{ color: '#334155' }}>📋 체크리스트:</p>
                <ul className="space-y-2 text-sm" style={{ color: '#475569' }}>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">①</span> 카카오 콘솔 → JavaScript 키 수정 페이지에서 도메인 추가 후 <strong style={{ color: '#0ea5e9' }}>저장 버튼을 클릭</strong>했는지 확인</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">②</span> 현재 사용 중인 키: <code className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: '#f1f5f9', color: '#0f172a' }}>{process.env.NEXT_PUBLIC_KAKAO_APP_KEY?.slice(0, 8)}...</code></li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">③</span> 카카오 콘솔 좌측 메뉴 → <strong>카카오맵</strong> 제품이 활성화되어 있는지 확인</li>
                </ul>
              </div>
            </div>
          ) : (
            <Map center={{ lat: 37.3827, lng: 127.1189 }} style={{ width: '100%', height: '100%' }} level={8}>
              {/* 현장 마커 */}
              {filtered.map((project, idx) => {
                const coords = project.lat && project.lng
                  ? { lat: project.lat, lng: project.lng }
                  : getMockCoords(idx);
                const isRejected = project.status === 'REJECTED';
                const isCompleted = project.status === 'COMPLETED';
                return (
                  <CustomOverlayMap key={project.id} position={coords} yAnchor={1}>
                    <div
                      className="px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 border cursor-pointer transition-transform hover:scale-110"
                      style={{ background: isRejected ? '#ef4444' : isCompleted ? '#10b981' : '#0ea5e9', color: '#fff', border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      onClick={() => setSelectedProject(project)}
                    >
                      <MapPin size={14} /><span className="font-bold text-xs whitespace-nowrap">{project.name}</span>
                    </div>
                  </CustomOverlayMap>
                );
              })}
              {/* 작업자 GPS 실시간 마커 */}
              {workerLocations.map(worker => (
                <CustomOverlayMap key={worker.uid} position={{ lat: worker.currentLat, lng: worker.currentLng }} yAnchor={1}>
                  <div
                    className="px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 border"
                    style={{ background: '#7c3aed', color: '#fff', border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}
                  >
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                    <span className="font-bold text-xs whitespace-nowrap">{worker.name}</span>
                  </div>
                </CustomOverlayMap>
              ))}
            </Map>
          )}
          <div className="absolute top-4 left-4 z-10 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 4px 16px rgba(14,165,233,0.15)' }}>
            <h3 className="font-bold mb-2 text-sm" style={{ color: '#0f172a' }}>실시간 투입 현황</h3>
            <div className="flex flex-col gap-1.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>긴급 {rejectedCount}건</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(14,165,233,0.1)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.25)' }}>진행중 {inProgressCount}건</span>
              {workerLocations.length > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>
                  GPS 작업자 {workerLocations.length}명
                </span>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* 긴급 조치 섹션 */}
          <section className="mb-10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#0f172a' }}>
              <AlertCircle size={20} style={{ color: '#ef4444' }} /> 긴급 조치 필요 현장
              {rejectedProjects.length > 0 && <span className="px-2.5 py-0.5 rounded-full text-sm font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>{rejectedProjects.length}</span>}
            </h3>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4">{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</div>
            ) : rejectedProjects.length === 0 ? (
              <div className="p-10 text-center rounded-2xl flex flex-col items-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 size={48} style={{ color: '#10b981', opacity: 0.5 }} className="mb-4" />
                <p className="text-lg font-semibold" style={{ color: '#334155' }}>
                  {searchQuery ? `"${searchQuery}" 검색 결과 없음` : '긴급 조치가 필요한 현장이 없습니다.'}
                </p>
                {!searchQuery && <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>모든 작업이 원활하게 진행 중입니다.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {rejectedProjects.map(project => (
                  <ProjectRow key={project.id} project={project} onDetail={() => setSelectedProject(project)} onRestart={() => updateStatus({ id: project.id, status: 'IN_PROGRESS' })} isPending={isPending} variant="rejected" />
                ))}
              </div>
            )}
          </section>

          {/* 진행 중 섹션 */}
          <section>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#0f172a' }}>
              <Clock size={20} style={{ color: '#0ea5e9' }} /> 현재 진행 중인 현장
              {inProgressProjects.length > 0 && <span className="px-2.5 py-0.5 rounded-full text-sm font-bold" style={{ background: 'rgba(14,165,233,0.1)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.25)' }}>{inProgressProjects.length}</span>}
            </h3>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4">{[1, 2].map(i => <SkeletonRow key={i} />)}</div>
            ) : inProgressProjects.length === 0 ? (
              <div className="p-8 text-center rounded-2xl flex flex-col items-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <Clock size={36} style={{ color: '#94a3b8', opacity: 0.5 }} className="mb-3" />
                <p style={{ color: '#64748b' }}>{searchQuery ? '검색 결과 없음' : '현재 진행 중인 현장이 없습니다.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {inProgressProjects.map(project => (
                  <ProjectRow key={project.id} project={project} onDetail={() => setSelectedProject(project)} onRestart={() => updateStatus({ id: project.id, status: 'COMPLETED' })} isPending={isPending} variant="inprogress" />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ProjectRow({ project, onDetail, onRestart, isPending, variant }: {
  project: ProjectData; onDetail: () => void; onRestart: () => void; isPending: boolean; variant: 'rejected' | 'inprogress';
}) {
  const isRejected = variant === 'rejected';
  const accentColor = isRejected ? '#ef4444' : '#0ea5e9';
  const accentBg    = isRejected ? 'rgba(239,68,68,0.06)' : 'rgba(14,165,233,0.06)';
  const accentBorder = isRejected ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.2)';

  return (
    <div className="p-5 rounded-2xl flex justify-between items-center transition-all hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', border: `1px solid ${accentBorder}`, boxShadow: `0 4px 24px ${accentBg.replace('0.06', '0.12')}, 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)` }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}11)`, border: `1.5px solid ${accentBorder}`, color: accentColor }}>
          <MapPin size={20} />
        </div>
        <div>
          <h4 className="text-base font-bold mb-0.5" style={{ color: '#0f172a' }}>{project.name}</h4>
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>
            작업자: {project.workerName}
            {isRejected && project.rejectReason && <> | <span className="font-semibold" style={{ color: accentColor }}>{project.rejectReason}</span>{project.timeElapsed && ` (${project.timeElapsed})`}</>}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onDetail} className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#334155', border: '1.5px solid rgba(14,165,233,0.2)', boxShadow: '0 2px 8px rgba(14,165,233,0.1)' }}
        >상세 보기 및 정산</button>
        <button onClick={onRestart} disabled={isPending}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50"
          style={{ background: isRejected ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : 'linear-gradient(135deg,#10b981,#059669)', boxShadow: `0 4px 16px ${isRejected ? 'rgba(14,165,233,0.35)' : 'rgba(16,185,129,0.35)'}` }}
        >
          {isRejected ? <><RefreshCcw size={15} />강제 재시작</> : <><CheckCircle2 size={15} />완료 처리</>}
        </button>
      </div>
    </div>
  );
}
