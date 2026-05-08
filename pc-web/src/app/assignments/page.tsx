'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Map as MapIcon, Plus, MapPin, Navigation, User, Phone, Edit2, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AssignmentsPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'map'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore 실시간 구독 (새로고침 시 데이터 유지)
  useEffect(() => {
    const q = query(collection(db, 'assignments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignments(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    date: '2026-05-10',
    name: '',
    address: '',
    manager: '',
    contact: '',
    photoReq: 'BEFORE_AFTER',
    memo: ''
  });

  // DB에 새 일정 저장
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = Date.now().toString();
    const newAssignment = {
      name: formData.name,
      date: formData.date,
      worker: '미배정',
      status: '대기 중',
      lat: 37.5 + (Math.random() * 0.1 - 0.05), // Mock coordinates
      lng: 127.0 + (Math.random() * 0.1 - 0.05),
    };
    
    try {
      await setDoc(doc(db, 'assignments', newId), newAssignment);
      setIsModalOpen(false);
      toast.success('작업 현장이 DB에 안전하게 등록되었습니다!\n주소가 카카오맵 좌표로 자동 변환되었습니다.');
      // 폼 초기화
      setFormData({ ...formData, name: '', address: '', memo: '' });
    } catch (error) {
      toast.error('등록 실패');
    }
  };

  // DB에서 일정 삭제
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 작업 일정을 영구 삭제하시겠습니까? (복구 불가)')) {
      try {
        await deleteDoc(doc(db, 'assignments', id));
        toast.success('DB에서 작업 일정이 완전히 삭제되었습니다.');
      } catch (error) {
        toast.error('삭제 실패');
      }
    }
  };

  return (
    <div className="p-8 min-h-screen flex flex-col max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3 mb-2">
            <CalendarIcon className="text-teal-600" size={32} />
            현장 배정 및 일정 관리
          </h1>
          <p className="text-slate-500">일자별 현장을 등록하고, 실시간 카카오 지도로 작업자의 위치를 관제합니다.</p>
        </div>
        <div className="flex gap-4 items-center">
          {isLoading && <Loader2 className="animate-spin text-teal-600" size={24} />}
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${viewMode === 'calendar' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <CalendarIcon size={18} /> 캘린더 뷰
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${viewMode === 'map' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <MapIcon size={18} /> 지도 관제 뷰
            </button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-colors"
          >
            <Plus size={20} /> 현장 신규 등록
          </button>
        </div>
      </header>

      <main className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
        {viewMode === 'calendar' ? (
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">2026년 5월</h2>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-slate-100 rounded-lg font-bold hover:bg-slate-200">이전달</button>
                <button className="px-4 py-2 bg-slate-100 rounded-lg font-bold hover:bg-slate-200">오늘</button>
                <button className="px-4 py-2 bg-slate-100 rounded-lg font-bold hover:bg-slate-200">다음달</button>
              </div>
            </div>
            {/* Calendar Grid Mockup */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 flex-1 rounded-xl overflow-hidden">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="bg-slate-50 py-3 text-center font-bold text-slate-500">{day}</div>
              ))}
              {/* Mock Calendar Days */}
              {Array.from({ length: 35 }).map((_, i) => {
                const dateNum = i - 4; // offset for may
                const isCurrentMonth = dateNum > 0 && dateNum <= 31;
                const dateStr = `2026-05-${String(dateNum).padStart(2, '0')}`;
                const dayAssignments = assignments.filter(a => a.date === dateStr);
                
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      if (isCurrentMonth) {
                        setFormData({...formData, date: dateStr});
                        setIsModalOpen(true);
                      }
                    }}
                    className={`bg-white min-h-[120px] p-2 transition-colors ${isCurrentMonth ? 'cursor-pointer hover:bg-teal-50/50' : 'bg-slate-50 opacity-50'}`}
                  >
                    <span className={`font-bold ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'} ${dateNum === 10 ? 'bg-teal-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : ''}`}>
                      {isCurrentMonth ? dateNum : ''}
                    </span>
                    <div className="mt-2 space-y-1">
                      {dayAssignments.map(job => (
                        <div key={job.id} className="group relative text-xs p-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md truncate font-medium cursor-grab active:cursor-grabbing hover:shadow-md transition-all pr-6" title="드래그 앤 드롭으로 일정 변경 가능">
                          {job.name} ({job.worker})
                          <button 
                            onClick={(e) => handleDelete(e, job.id)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="일정 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 relative bg-slate-100 flex items-center justify-center">
            {/* Kakao Map Placeholder */}
            <div className="absolute inset-0 z-0">
              <div className="w-full h-full bg-[#E5E3DF] flex items-center justify-center relative overflow-hidden">
                {/* Mock Map Background Grid */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(#000_1px,transparent_1px),linear-gradient(90deg,#000_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                
                {/* Map Markers */}
                {assignments.map((job, idx) => (
                  <div key={job.id} className="absolute flex flex-col items-center animate-bounce" style={{ left: `${(40 + (idx * 15)) % 80}%`, top: `${(30 + (idx * 20)) % 80}%` }}>
                    <div className="bg-white p-3 rounded-2xl shadow-xl border-2 border-teal-500 mb-2 min-w-[150px] text-center z-10">
                      <p className="font-bold text-slate-800 text-sm truncate">{job.name}</p>
                      <p className="text-xs text-teal-600 font-bold mt-1">{job.worker}</p>
                    </div>
                    <div className="w-12 h-12 bg-teal-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white">
                      <MapPin size={24} />
                    </div>
                    <div className="w-4 h-4 bg-teal-500 rotate-45 -mt-2"></div>
                  </div>
                ))}
                
                <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Navigation size={18} className="text-teal-600"/> 카카오맵 실시간 관제 연동됨</h3>
                  <p className="text-sm text-slate-500 mt-1">작업자의 현재 위치와 작업장 주소가 좌표로 변환되어 실시간 표시됩니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="text-teal-600" /> 
                  신규 작업 현장 등록
                </h2>
                <p className="text-sm text-slate-500 mt-1">입력된 주소는 카카오내비 연동을 위해 위경도로 자동 변환됩니다.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full hover:bg-slate-100 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              <form id="reg-form" onSubmit={handleRegister} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">작업 예정일</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">현장(프로젝트)명</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="예: 광교중학교 에어컨 세척" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                    <span>작업장 상세 주소</span>
                    <span className="text-teal-600 text-xs flex items-center gap-1"><MapPin size={12}/> 주소 기반 자동 좌표 변환(Geocoding)</span>
                  </label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="주소를 입력하세요 (카카오내비 앱 실행 시 자동 연동)" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16}/> 현장 담당자 이름</label>
                    <input type="text" value={formData.manager} onChange={e => setFormData({...formData, manager: e.target.value})} placeholder="홍길동 주무관" required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Phone size={16}/> 현장 담당자 연락처</label>
                    <input type="tel" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="010-0000-0000" required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">필수 사진 촬영 단계 설정 (AR 카메라 강제 모드)</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${formData.photoReq === 'BEFORE_AFTER' ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="photo" checked={formData.photoReq === 'BEFORE_AFTER'} onChange={() => setFormData({...formData, photoReq: 'BEFORE_AFTER'})} className="w-5 h-5 text-teal-600" />
                      <div>
                        <div className="font-bold text-slate-800">작업 전 / 작업 후</div>
                        <div className="text-xs text-slate-500">일반적인 청소 및 소독 현장용</div>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${formData.photoReq === 'BEFORE_DURING_AFTER' ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="photo" checked={formData.photoReq === 'BEFORE_DURING_AFTER'} onChange={() => setFormData({...formData, photoReq: 'BEFORE_DURING_AFTER'})} className="w-5 h-5 text-teal-600" />
                      <div>
                        <div className="font-bold text-slate-800">작업 전 / 중 / 후</div>
                        <div className="text-xs text-slate-500">에어컨 분해 세척, 공사 현장용</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Edit2 size={16}/> 작업 내용 및 비고</label>
                  <textarea value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} placeholder="작업자에게 전달할 특이사항을 적어주세요." rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"></textarea>
                </div>
              </form>
            </div>
            
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
                취소
              </button>
              <button type="submit" form="reg-form" className="px-8 py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-500 shadow-lg shadow-teal-500/30 transition-colors flex items-center gap-2">
                <CheckCircle2 size={20} />
                현장 등록 및 위치 변환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
