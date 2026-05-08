'use client';

import { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, RefreshCcw, Loader2, Search, X } from 'lucide-react';
import { useProjects, useUpdateProjectStatus, ProjectData } from '@/hooks/useProjects';
import ProjectDetailsModal from '@/components/ProjectDetailsModal';

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();
  const { mutate: updateStatus, isPending } = useUpdateProjectStatus();

  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
          <div className="px-4 py-2 bg-slate-800/50 border border-emerald-500/20 rounded-full backdrop-blur-md flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-sm font-medium text-emerald-400">Firestore 통신 정상</span>
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
        {/* 지도 관제 뷰 (플레이스홀더/UI만 선행 구현) */}
        <section className="h-[600px] w-full rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-md flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=Seoul,KR&zoom=11&size=1000x600&style=feature:all|element:labels.text.fill|color:0x8ec3b9&style=feature:all|element:labels.text.stroke|color:0x1a3646&style=feature:administrative.country|element:geometry.stroke|color:0x4b6878&style=feature:administrative.land_parcel|element:labels.text.fill|color:0x64779e&style=feature:administrative.province|element:geometry.stroke|color:0x4b6878&style=feature:landscape.man_made|element:geometry.stroke|color:0x334e87&style=feature:landscape.natural|element:geometry|color:0x023e58&style=feature:poi|element:geometry|color:0x283d6a&style=feature:poi|element:labels.text.fill|color:0x6f9ba5&style=feature:poi|element:labels.text.stroke|color:0x1d2c4d&style=feature:poi.park|element:geometry.fill|color:0x023e58&style=feature:poi.park|element:labels.text.fill|color:0x3C7680&style=feature:road|element:geometry|color:0x304a7d&style=feature:road|element:labels.text.fill|color:0x98a5be&style=feature:road|element:labels.text.stroke|color:0x1d2c4d&style=feature:road.highway|element:geometry|color:0x2c6675&style=feature:road.highway|element:geometry.stroke|color:0x255763&style=feature:road.highway|element:labels.text.fill|color:0xb0d5ce&style=feature:road.highway|element:labels.text.stroke|color:0x023e58&style=feature:transit|element:labels.text.fill|color:0x98a5be&style=feature:transit|element:labels.text.stroke|color:0x1d2c4d&style=feature:transit.line|element:geometry.fill|color:0x283d6a&style=feature:transit.station|element:geometry|color:0x3a4762&style=feature:water|element:geometry|color:0x0e1626&style=feature:water|element:labels.text.fill|color:0x4e6d70')] bg-cover bg-center opacity-30 mix-blend-luminosity"></div>
          
          <MapPin size={48} className="text-teal-400 mb-4 animate-bounce z-10" />
          <h2 className="text-2xl font-bold text-white mb-2 z-10">실시간 지도 관제 시스템</h2>
          <p className="text-slate-400 max-w-md text-center z-10">
            현재 API 연동 준비 중입니다. 연동이 완료되면 전국 작업 현장과 
            실무자의 실시간 위치가 자동으로 클러스터링되어 표시됩니다.
          </p>
          <div className="mt-6 flex gap-3 z-10">
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 text-sm font-medium">긴급 {rejectedCount}</span>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30 text-sm font-medium">진행중 {inProgressCount}</span>
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
