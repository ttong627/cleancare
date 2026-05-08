'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FileText, Printer, Send, Search, Image as ImageIcon, Download, CheckCircle2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ProjectData } from '@/hooks/useProjects';

export default function ReportsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // COMPLETED 상태인 현장만 불러옴
    const q = query(collection(db, 'projects'), where('status', '==', 'COMPLETED'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectData));
      // 최신순 정렬
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProjects(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.workerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    if (!selectedProject) return;
    window.print();
  };

  const handleSavePDF = async () => {
    if (!reportRef.current || !selectedProject) return;
    const toastId = toast.loading('PDF를 생성하는 중입니다...');
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`작업보고서_${selectedProject.name}.pdf`);
      toast.success('PDF 저장이 완료되었습니다.', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('PDF 생성 중 오류가 발생했습니다.', { id: toastId });
    }
  };

  const handleSendFax = () => {
    // 팩스 대기열로 이동하는 기능 (여기서는 토스트로 안내 후 팩스 페이지로 유도)
    toast.success('보고서가 준비되었습니다. 팩스 전송 페이지에서 발송해주세요!', { duration: 4000 });
    window.location.href = `/fax?docName=${encodeURIComponent(selectedProject?.name + ' 작업완료보고서')}`;
  };

  return (
    <div className="p-8 min-h-screen flex flex-col print:p-0 print:bg-white print:min-h-0">
      {/* 헤더: 인쇄 시 숨김 */}
      <header className="mb-8 flex justify-between items-end print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <FileText className="text-indigo-400" size={32} />
            작업 보고서 및 출력 관리
          </h1>
          <p className="text-slate-400">완료된 현장의 사진 대장을 확인하고, PDF 저장 및 팩스 전송을 진행합니다.</p>
        </div>
      </header>

      <div className="flex gap-6 h-[calc(100vh-160px)] print:h-auto print:block">
        
        {/* 왼쪽 목록 패널: 인쇄 시 숨김 */}
        <div className="w-1/3 flex flex-col bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden print:hidden">
          <div className="p-5 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="현장명, 작업자명 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">완료된 현장이 없습니다.</div>
            ) : (
              filteredProjects.map(project => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedProject?.id === project.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white text-lg">{project.name}</h3>
                    <CheckCircle2 className="text-emerald-500" size={18} />
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-2">
                    <Building2 size={14} /> 담당: {project.workerName || '미배정'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽 보고서 뷰어 패널 */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 print:rounded-none print:border-none print:bg-white print:w-full print:m-0">
          {selectedProject ? (
            <>
              {/* 툴바: 인쇄 시 숨김 */}
              <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200 print:hidden">
                <div className="font-bold text-slate-700 flex items-center gap-2">
                  <ImageIcon size={18} className="text-indigo-500" />
                  보고서 미리보기
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
                    <Printer size={16} /> 인쇄
                  </button>
                  <button onClick={handleSavePDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
                    <Download size={16} /> PDF 저장
                  </button>
                  <button onClick={handleSendFax} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors">
                    <Send size={16} /> 팩스 발송
                  </button>
                </div>
              </div>

              {/* A4 보고서 영역 (인쇄 영역) */}
              <div className="flex-1 overflow-y-auto bg-slate-200 p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible">
                <div ref={reportRef} className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl p-12 print:shadow-none print:p-8 print:w-full">
                  <div className="text-center mb-10 border-b-2 border-slate-800 pb-6">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">작 업 보 고 서</h1>
                  </div>

                  <table className="w-full mb-10 border-collapse border-2 border-slate-800 text-slate-800">
                    <tbody>
                      <tr>
                        <th className="border border-slate-800 p-3 bg-slate-100 font-bold w-1/4">작업 현장명</th>
                        <td className="border border-slate-800 p-3 font-semibold" colSpan={3}>{selectedProject.name}</td>
                      </tr>
                      <tr>
                        <th className="border border-slate-800 p-3 bg-slate-100 font-bold w-1/4">담당 작업자</th>
                        <td className="border border-slate-800 p-3 w-1/4">{selectedProject.workerName || '-'}</td>
                        <th className="border border-slate-800 p-3 bg-slate-100 font-bold w-1/4">작업 일자</th>
                        <td className="border border-slate-800 p-3 w-1/4">{new Date(selectedProject.updatedAt || Date.now()).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-indigo-500 pl-3">작업 현장 사진대장</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    {/* BEFORE 사진 (가상 플레이스홀더) */}
                    <div className="border-2 border-slate-300 rounded-lg overflow-hidden flex flex-col">
                      <div className="bg-slate-100 text-center py-2 font-bold text-slate-700 border-b border-slate-300">작업 전 (BEFORE)</div>
                      <div className="h-64 bg-slate-50 flex items-center justify-center relative">
                        {/* 실제 운영 환경에서는 project.beforePhotoUrl 등을 렌더링해야 함 */}
                        <div className="text-slate-400 flex flex-col items-center">
                          <ImageIcon size={48} className="mb-2 opacity-50" />
                          <span>등록된 사진이 없습니다.</span>
                        </div>
                      </div>
                    </div>

                    {/* AFTER 사진 (가상 플레이스홀더) */}
                    <div className="border-2 border-slate-300 rounded-lg overflow-hidden flex flex-col">
                      <div className="bg-slate-100 text-center py-2 font-bold text-slate-700 border-b border-slate-300">작업 후 (AFTER)</div>
                      <div className="h-64 bg-slate-50 flex items-center justify-center relative">
                        <div className="text-slate-400 flex flex-col items-center">
                          <ImageIcon size={48} className="mb-2 opacity-50" />
                          <span>등록된 사진이 없습니다.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-16 text-center text-slate-600">
                    <p className="mb-4 text-lg">위와 같이 작업이 완료되었음을 보고합니다.</p>
                    <div className="font-bold text-xl mt-8">크린케어 통합관제시스템</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 print:hidden">
              <FileText size={64} className="mb-4 opacity-30" />
              <p className="text-lg font-medium text-slate-500">왼쪽 목록에서 보고서를 출력할 현장을 선택해주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
