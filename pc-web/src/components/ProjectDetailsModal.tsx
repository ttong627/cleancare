'use client';

import { X, FileText, Printer, Mail, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProjectData } from '@/hooks/useProjects';

interface ProjectDetailsModalProps {
  project: ProjectData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectDetailsModal({ project, isOpen, onClose }: ProjectDetailsModalProps) {
  if (!isOpen || !project) return null;

  // 가상 액션 핸들러 (UI 모의 구동)
  const handleAction = (actionName: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)), // 1.5초 가상 로딩
      {
        loading: `${actionName} 진행 중...`,
        success: <b>{actionName} 처리가 완료되었습니다!</b>,
        error: <b>서버 연동에 실패했습니다.</b>,
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* 헤더 */}
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              {project.name}
              <span className={`text-xs px-3 py-1 rounded-full border ${
                project.status === 'REJECTED' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                project.status === 'IN_PROGRESS' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {project.status === 'REJECTED' ? '긴급 조치' : project.status === 'IN_PROGRESS' ? '진행중' : '완료됨'}
              </span>
            </h2>
            <p className="text-slate-400 mt-1 text-sm">담당 작업자: {project.workerName} | 경과 시간: {project.timeElapsed || '기록 없음'}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row gap-8">
          
          {/* 왼쪽: 현장 사진 및 도면 영역 */}
          <div className="flex-1 space-y-6">
            <h3 className="text-lg font-semibold text-white border-l-4 border-blue-500 pl-3">현장 AR 증빙 자료</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="aspect-video bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent z-10"></div>
                  <p className="absolute bottom-3 left-3 text-sm font-medium text-white z-20">작업 전 (도면 스캔)</p>
                  <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=600')] bg-cover bg-center opacity-60 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="aspect-video bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent z-10"></div>
                  <p className="absolute bottom-3 left-3 text-sm font-medium text-white z-20">작업 후 (AI 검증 완료)</p>
                  <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1628177142898-93e46e6160a7?q=80&w=600')] bg-cover bg-center opacity-60 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </div>
            
            {project.status === 'REJECTED' && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <h4 className="text-red-400 font-bold mb-1">AI 반려 사유</h4>
                <p className="text-red-200 text-sm">{project.rejectReason}</p>
              </div>
            )}
          </div>

          {/* 오른쪽: 원스톱 행정 처리 (정산 및 보고서) */}
          <div className="md:w-80 space-y-6">
            <h3 className="text-lg font-semibold text-white border-l-4 border-emerald-500 pl-3">원스톱 행정 처리</h3>
            
            <div className="space-y-3">
              <button 
                onClick={() => handleAction('PDF 보고서 자동 생성')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <FileText size={20} />
                  </div>
                  <span className="font-medium text-slate-200">PDF 완료 보고서 생성</span>
                </div>
              </button>

              <button 
                onClick={() => handleAction('국세청 세금계산서 연동 발급')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Calculator size={20} />
                  </div>
                  <span className="font-medium text-slate-200">견적서 및 세금계산서 발행</span>
                </div>
              </button>

              <button 
                onClick={() => handleAction('관공서 웹팩스 일괄 전송')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                    <Printer size={20} />
                  </div>
                  <span className="font-medium text-slate-200">관공서 팩스 일괄 전송</span>
                </div>
              </button>

              <button 
                onClick={() => handleAction('담당자 확인 메일 전송')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <Mail size={20} />
                  </div>
                  <span className="font-medium text-slate-200">담당자 메일 전송</span>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
