'use client';

import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, RefreshCcw, Loader2, Search, X, Cloud, Sun, CloudRain } from 'lucide-react';
import { useProjects, useUpdateProjectStatus, ProjectData } from '@/hooks/useProjects';
import ProjectDetailsModal from '@/components/ProjectDetailsModal';
import { Map, MapMarker, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();
  const { mutate: updateStatus, isPending } = useUpdateProjectStatus();

  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // 카카오맵 로드 (API 키 없으면 로드 생략)
  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_APP_KEY || 'dummy_key',
    libraries: ['clusterer', 'services'],
  });

  // 실시간 날씨 상태
  const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string } | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
        if (!apiKey) return;
        // 서울/경기 중심 좌표 (임시)
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=37.5665&lon=126.9780&units=metric&lang=kr&appid=${apiKey}`);
        const data = await res.json();
        if (data.main) {
          setWeather({
            temp: Math.round(data.main.temp),
            desc: data.weather[0].description,
            icon: data.weather[0].main, // 'Clear', 'Clouds', 'Rain' 등
          });
        }
      } catch (err) {
        console.error("날씨 정보 연동 실패:", err);
      }
    }
    fetchWeather();
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.workerName.toLowerCase().includes(q) ||
      (p.rejectReason ?? '').toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const rejectedCount    = projects?.filter(p => p.status === 'REJECTED').length ?? 0;
  const inProgressCount  = projects?.filter(p => p.status === 'IN_PROGRESS').length ?? 0;
  const completedCount   = projects?.filter(p => p.status === 'COMPLETED').length ?? 0;

  const rejectedProjects   = filtered.filter(p => p.status === 'REJECTED');
  const inProgressProjects = filtered.filter(p => p.status === 'IN_PROGRESS');

  const SkeletonRow = () => (
    <div className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
  );

  // 현장 좌표 모의 생성 (DB에 좌표가 없을 경우를 대비한 헬퍼)
  const getMockCoords = (index: number) => ({
    lat: 37.3827 + (index * 0.02 * (index % 2 === 0 ? 1 : -1)), // 판교 주변 기준 분산
    lng: 127.1189 + (index * 0.03 * (index % 3 === 0 ? 1 : -1)),
  });

  return (
    <div className="min-h-screen p-8 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
      <ProjectDetailsModal
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      {/* 헤더 */}
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Navigation className="text-teal-400" size={32} />
            크린케어 통합 관제센터
          </h1>
          <p className="text-slate-400 mt-2">전국 현장 실시간 모니터링 (Exception-First) — 라이브 클라우드 서버 연동 중</p>
        </div>
        <div className="flex items-center gap-6">
          {/* 뷰 토글 버튼 */}
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list' 
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              리스트 뷰
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'map' 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              지도 관제 뷰
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm">동기화 중...</span>
            </div>
          )}

          {/* 날씨 위젯 */}
          {weather && (
            <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full backdrop-blur-md flex items-center gap-2 shadow-inner">
              {weather.icon === 'Clear' ? <Sun size={18} className="text-yellow-400" /> : 
               weather.icon === 'Rain' ? <CloudRain size={18} className="text-blue-400" /> : 
               <Cloud size={18} className="text-slate-400" />}
              <span className="text-sm font-medium text-slate-200">{weather.temp}°C {weather.desc}</span>
            </div>
          )}

          <div className="px-4 py-2 bg-slate-800/50 border border-emerald-500/20 rounded-full backdrop-blur-md flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-sm font-medium text-emerald-400">DB Live</span>
          </div>
        </div>
      </header>

      {/* 상태 요약 위젯 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: '긴급 조치 요망', count: rejectedCount,   color: 'red',     icon: <AlertCircle size={28} /> },
          { label: '작업 진행 중',   count: inProgressCount, color: 'blue',    icon: <Clock size={28} /> },
          { label: '오늘 완료된 작업', count: completedCount, color: 'emerald', icon: <CheckCircle2 size={28} /> },
        ].map(({ label, count, color, icon }) => (
          <div key={label} className={`p-6 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 backdrop-blur-sm transition-transform hover:-translate-y-1`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-${color}-400 font-semibold mb-1`}>{label}</p>
                <h2 className="text-4xl font-bold text-white">
                  {isLoading
                    ? <span className="animate-pulse bg-white/20 h-10 w-16 rounded block mt-1" />
                    : <>{count}<span className="text-lg font-normal text-slate-400 ml-1">건</span></>
                  }
                </h2>
              </div>
              <div className={`p-3 bg-${color}-500/20 rounded-xl text-${color}-500`}>{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 바 */}
      {viewMode === 'list' && (
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="현장명, 작업자, 반려 사유 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl pl-11 pr-10 py-3 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-500 backdrop-blur-sm shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {viewMode === 'map' ? (
        <section className="h-[600px] w-full rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-md shadow-xl relative overflow-hidden">
          {!process.env.NEXT_PUBLIC_KAKAO_APP_KEY ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-900/80 backdrop-blur-sm">
              <MapPin size={48} className="text-teal-400 mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold text-white mb-2">카카오맵 API 연동 완료</h2>
              <p className="text-slate-400 max-w-md text-center bg-slate-800 p-4 rounded-lg border border-slate-700">
                .env.local 파일에 <code>NEXT_PUBLIC_KAKAO_APP_KEY</code>를 입력하시면 실제 지도가 즉시 렌더링됩니다.
              </p>
            </div>
          ) : loading ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/80">
              <Loader2 className="animate-spin text-teal-500" size={48} />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/80 text-red-400">
              지도를 불러오는데 실패했습니다. API 키를 확인해주세요.
            </div>
          ) : (
            <Map 
              center={{ lat: 37.3827, lng: 127.1189 }} // 초기 중심 (판교)
              style={{ width: "100%", height: "100%" }}
              level={8}
              className="z-0"
            >
              {filtered.map((project, idx) => {
                const coords = getMockCoords(idx);
                const isRejected = project.status === 'REJECTED';
                const isCompleted = project.status === 'COMPLETED';
                
                return (
                  <CustomOverlayMap key={project.id} position={coords} yAnchor={1}>
                    <div 
                      className={`px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 border cursor-pointer transition-transform hover:scale-110 
                        ${isRejected ? 'bg-red-500 text-white border-red-600' : 
                          isCompleted ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-blue-500 text-white border-blue-600'}`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <MapPin size={16} />
                      <span className="font-semibold text-xs whitespace-nowrap">{project.name}</span>
                    </div>
                  </CustomOverlayMap>
                );
              })}
            </Map>
          )}

          {/* 지도 오버레이 UI */}
          <div className="absolute top-4 left-4 z-10 bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 backdrop-blur-md">
            <h3 className="text-white font-semibold mb-2">실시간 투입 현황</h3>
            <div className="flex flex-col gap-2">
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 text-sm font-medium">긴급 {rejectedCount}건</span>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30 text-sm font-medium">진행중 {inProgressCount}건</span>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* 긴급 조치 섹션 */}
          <section className="mb-10">
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <AlertCircle size={20} className="text-red-500" /> 긴급 조치 필요 현장
              {rejectedProjects.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-sm rounded-full border border-red-500/30">
                  {rejectedProjects.length}
                </span>
              )}
            </h3>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4">{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</div>
            ) : rejectedProjects.length === 0 ? (
              <div className="p-10 text-center rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 flex flex-col items-center shadow-inner">
                <CheckCircle2 size={48} className="text-teal-500 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {searchQuery ? `"${searchQuery}" 검색 결과 없음` : '긴급 조치가 필요한 현장이 없습니다.'}
                </p>
                {!searchQuery && <p className="text-sm mt-2 opacity-70">모든 작업이 원활하게 진행 중입니다.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {rejectedProjects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onDetail={() => setSelectedProject(project)}
                    onRestart={() => updateStatus({ id: project.id, status: 'IN_PROGRESS' })}
                    isPending={isPending}
                    variant="rejected"
                  />
                ))}
              </div>
            )}
          </section>

          {/* 진행 중 섹션 */}
          <section>
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <Clock size={20} className="text-blue-400" /> 현재 진행 중인 현장
              {inProgressProjects.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-sm rounded-full border border-blue-500/30">
                  {inProgressProjects.length}
                </span>
              )}
            </h3>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4">{[1, 2].map(i => <SkeletonRow key={i} />)}</div>
            ) : inProgressProjects.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-500 flex flex-col items-center shadow-inner">
                <Clock size={36} className="mb-3 opacity-30" />
                <p className="text-base">{searchQuery ? '검색 결과 없음' : '현재 진행 중인 현장이 없습니다.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {inProgressProjects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onDetail={() => setSelectedProject(project)}
                    onRestart={() => updateStatus({ id: project.id, status: 'COMPLETED' })}
                    isPending={isPending}
                    variant="inprogress"
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ── 공통 프로젝트 카드 컴포넌트 ── */
function ProjectRow({
  project, onDetail, onRestart, isPending, variant,
}: {
  project: ProjectData;
  onDetail: () => void;
  onRestart: () => void;
  isPending: boolean;
  variant: 'rejected' | 'inprogress';
}) {
  const isRejected = variant === 'rejected';

  return (
    <div className={`p-5 rounded-xl border backdrop-blur-md flex justify-between items-center group transition-colors
      ${isRejected
        ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
        : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
      }`}
    >
      <div className="flex items-center gap-5">
        <div className={`w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border
          ${isRejected ? 'border-red-500/30 text-red-400' : 'border-blue-500/30 text-blue-400'}`}
        >
          <MapPin size={20} />
        </div>
        <div>
          <h4 className="text-lg font-medium text-white">{project.name}</h4>
          <p className={`text-sm mt-1 ${isRejected ? 'text-red-300' : 'text-blue-300'}`}>
            작업자: {project.workerName}
            {isRejected && project.rejectReason && (
              <> | <span className="font-semibold">{project.rejectReason}</span>
                {project.timeElapsed && ` (${project.timeElapsed})`}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onDetail}
          className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors border border-slate-600"
        >
          상세 보기 및 정산
        </button>
        <button
          onClick={onRestart}
          disabled={isPending}
          className={`px-5 py-2 text-white rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50
            ${isRejected
              ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
            }`}
        >
          {isRejected
            ? <><RefreshCcw size={16} /> 강제 재시작</>
            : <><CheckCircle2 size={16} /> 완료 처리</>
          }
        </button>
      </div>
    </div>
  );
}
