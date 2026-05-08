'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, RefreshCcw, Loader2 } from 'lucide-react';
import { useProjects, useUpdateProjectStatus, ProjectData } from '@/hooks/useProjects';
import ProjectDetailsModal from '@/components/ProjectDetailsModal';

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();
  const { mutate: updateStatus, isPending } = useUpdateProjectStatus();
  
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);

  // 데이터 필터링 계산
  const rejectedCount = projects?.filter(p => p.status === 'REJECTED').length || 0;
  const inProgressCount = projects?.filter(p => p.status === 'IN_PROGRESS').length || 0;
  const completedCount = projects?.filter(p => p.status === 'COMPLETED').length || 0;
  
  // 예외 중심 (반려된 건만 리스트에 우선 노출)
  const rejectedProjects = projects?.filter(p => p.status === 'REJECTED') || [];

  return (
    <div className="min-h-screen p-8 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black relative">
      
      {/* 모달 연동 */}
      <ProjectDetailsModal 
        project={selectedProject} 
        isOpen={!!selectedProject} 
        onClose={() => setSelectedProject(null)} 
      />

      {/* 헤더 영역 */}
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Navigation className="text-blue-500" size={32} />
            크린케어 통합 관제센터
          </h1>
          <p className="text-slate-400 mt-2">전국 현장 실시간 모니터링 (Exception-First) - 라이브 클라우드 서버 연동 중</p>
        </div>
        <div className="flex items-center gap-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm">클라우드 동기화 중...</span>
            </div>
          )}
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-medium text-slate-300">Firestore 통신 정상</span>
          </div>
        </div>
      </header>

      {/* 상태 요약 위젯 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-400 font-semibold mb-1">긴급 조치 요망</p>
              <h2 className="text-4xl font-bold text-white">
                {isLoading ? <span className="animate-pulse bg-white/20 h-10 w-16 rounded block mt-1"></span> : rejectedCount}
                {!isLoading && <span className="text-lg font-normal text-slate-400 ml-1">건</span>}
              </h2>
            </div>
            <div className="p-3 bg-red-500/20 rounded-xl text-red-500">
              <AlertCircle size={28} />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-400 font-semibold mb-1">작업 진행 중</p>
              <h2 className="text-4xl font-bold text-white">
                {isLoading ? <span className="animate-pulse bg-white/20 h-10 w-16 rounded block mt-1"></span> : inProgressCount}
                {!isLoading && <span className="text-lg font-normal text-slate-400 ml-1">건</span>}
              </h2>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500">
              <Clock size={28} />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-400 font-semibold mb-1">오늘 완료된 작업</p>
              <h2 className="text-4xl font-bold text-white">
                {isLoading ? <span className="animate-pulse bg-white/20 h-10 w-16 rounded block mt-1"></span> : completedCount}
                {!isLoading && <span className="text-lg font-normal text-slate-400 ml-1">건</span>}
              </h2>
            </div>
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-500">
              <CheckCircle2 size={28} />
            </div>
          </div>
        </div>
      </div>

      {/* 예외 중심 리스트 (긴급건 우선 노출) */}
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <AlertCircle size={20} className="text-red-500" /> 긴급 조치 필요 현장
      </h3>
      
      {isLoading ? (
        // 로딩 스켈레톤 UI
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse"></div>
          ))}
        </div>
      ) : rejectedProjects.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-white/5 border border-white/10 text-slate-400 flex flex-col items-center">
          <CheckCircle2 size={48} className="text-emerald-500 mb-4 opacity-50" />
          <p className="text-lg font-medium">현재 긴급 조치가 필요한 현장이 없습니다.</p>
          <p className="text-sm mt-2 opacity-70">모든 작업이 원활하게 진행 중입니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rejectedProjects.map((project) => (
            <div key={project.id} className="p-5 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors backdrop-blur-md flex justify-between items-center group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-red-500/30 text-red-400">
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-white">{project.name}</h4>
                  <p className="text-sm text-red-300 mt-1">
                    작업자: {project.workerName} | <span className="font-semibold">{project.rejectReason}</span> ({project.timeElapsed})
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectedProject(project)}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors border border-slate-600"
                >
                  상세 보기 및 정산
                </button>
                <button 
                  onClick={() => updateStatus({ id: project.id, status: 'IN_PROGRESS' })}
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCcw size={16} /> 강제 재시작 (해결)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
