'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Bell, MapPin, UserPlus, MoreVertical } from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface WorkerData {
  id: string;
  name: string;
  role: string;
  status: 'ONLINE' | 'WORKING' | 'OFFLINE';
  lastLocation: string;
  assignedProject?: string;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'workers'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        await seedWorkersData();
        return;
      }
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkerData));
      setWorkers(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePushNotification = (workerName: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: `${workerName}님에게 푸시 알림 전송 중...`,
        success: <b>{workerName}님 기기로 긴급 알림 전송 완료!</b>,
        error: <b>전송 실패</b>,
      }
    );
  };

  const filteredWorkers = workers.filter(w => w.name.includes(searchQuery) || w.role.includes(searchQuery));

  return (
    <div className="p-8 min-h-screen flex flex-col">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Users className="text-blue-500" size={32} />
            현장 작업자 종합 관리
          </h1>
          <p className="text-slate-400">등록된 작업자의 실시간 위치(GPS), 근태 상태 및 프로젝트 배정 현황을 관제합니다.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-colors">
          <UserPlus size={18} /> 신규 작업자 등록
        </button>
      </header>

      {/* 통계 위젯 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: '전체 작업자', value: workers.length, color: 'text-white' },
          { label: '현재 작업 중', value: workers.filter(w => w.status === 'WORKING').length, color: 'text-blue-400' },
          { label: '대기(온라인)', value: workers.filter(w => w.status === 'ONLINE').length, color: 'text-emerald-400' },
          { label: '오프라인', value: workers.filter(w => w.status === 'OFFLINE').length, color: 'text-slate-500' },
        ].map((stat, idx) => (
          <div key={idx} className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
            <p className="text-slate-400 font-medium mb-1">{stat.label}</p>
            <h3 className={`text-3xl font-bold ${stat.color}`}>{isLoading ? '-' : stat.value}명</h3>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="이름 또는 직급으로 검색..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* 리스트 렌더링 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full p-10 text-center text-slate-500">데이터 연동 중...</div>
        ) : filteredWorkers.map(worker => (
          <div key={worker.id} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 hover:bg-slate-800/60 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300 relative">
                  {worker.name[0]}
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
                    worker.status === 'WORKING' ? 'bg-blue-500' :
                    worker.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}></div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{worker.name}</h3>
                  <p className="text-sm text-slate-400">{worker.role}</p>
                </div>
              </div>
              <button className="text-slate-500 hover:text-white"><MoreVertical size={20}/></button>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <MapPin size={16} className="text-slate-500" />
                {worker.lastLocation}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-slate-900 rounded text-slate-400 text-xs">현재 현장</span>
                <span className="text-blue-400 truncate font-medium">{worker.assignedProject || '배정 대기 중'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handlePushNotification(worker.name)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                <Bell size={16} /> 긴급 푸시 전송
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 자동 시드 로직
async function seedWorkersData() {
  const snapshot = await getDocs(collection(db, 'workers'));
  if (!snapshot.empty) return;

  const mockWorkers: WorkerData[] = [
    { id: 'w1', name: '김철수', role: '현장 팀장 (1팀)', status: 'WORKING', lastLocation: '수원 광교중학교 부근', assignedProject: '수원 광교중학교 에어컨 세척' },
    { id: 'w2', name: '이영희', role: '특수 청소 전문가', status: 'WORKING', lastLocation: '판교 테크원타워 지하 1층', assignedProject: '판교 테크원타워 로비 청소' },
    { id: 'w3', name: '박지민', role: '일반 작업자', status: 'OFFLINE', lastLocation: '강남역 2번 출구 (어제)', assignedProject: undefined },
    { id: 'w4', name: '정민수', role: '방역 전문가', status: 'ONLINE', lastLocation: '용인 처인구청 앞', assignedProject: '용인 처인구 LH 아파트 방역' },
    { id: 'w5', name: '최수진', role: '현장 지원 스태프', status: 'ONLINE', lastLocation: '성남 시청 본관', assignedProject: undefined },
  ];

  for (const worker of mockWorkers) {
    const { id, ...data } = worker;
    await setDoc(doc(db, 'workers', id), data);
  }
}
