import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- (추후 실제 Firebase 연동 시 주석 해제) ---
// import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
// import { db } from '@/lib/firebase';

export type ProjectStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface ProjectData {
  id: string;
  name: string;
  workerName: string;
  status: ProjectStatus;
  rejectReason?: string;
  timeElapsed?: string;
}

// 가상 데이터 (Firebase API Key 세팅 전까지 동작하는 완벽한 Mock 데이터)
let MOCK_DATA: ProjectData[] = [
  { id: 'p1', name: '수원 광교중학교 에어컨 세척', workerName: '김철수', status: 'REJECTED', rejectReason: 'AI 구도 불일치로 반려됨', timeElapsed: '30분 경과' },
  { id: 'p2', name: '판교 테크원타워 로비 청소', workerName: '이영희', status: 'REJECTED', rejectReason: '작업 구역 누락', timeElapsed: '1시간 경과' },
  { id: 'p3', name: '강남역 지하상가 환풍구 정비', workerName: '박지민', status: 'REJECTED', rejectReason: '현장 조도 불량으로 사진 식별 불가', timeElapsed: '15분 경과' },
  { id: 'p4', name: '용인 처인구 LH 아파트 방역', workerName: '정민수', status: 'IN_PROGRESS' },
  { id: 'p5', name: '성남 시청 부속실 청소', workerName: '최수진', status: 'IN_PROGRESS' },
  { id: 'p6', name: '분당 정자초등학교 방역', workerName: '김철수', status: 'COMPLETED' },
  { id: 'p7', name: '수지구청 식당 후드 청소', workerName: '이영희', status: 'COMPLETED' },
];

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      // 무지연 스켈레톤 UI를 보여주기 위해 0.8초 딜레이 추가 (네트워크 시뮬레이션)
      await new Promise(resolve => setTimeout(resolve, 800));
      return MOCK_DATA;
    }
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string, status: ProjectStatus }) => {
      await new Promise(resolve => setTimeout(resolve, 500)); // 서버 업데이트 시뮬레이션
      MOCK_DATA = MOCK_DATA.map(p => p.id === id ? { ...p, status, rejectReason: undefined } : p);
    },
    onSuccess: () => {
      // 상태 변경 후 즉각적으로 캐시를 무효화하여 화면을 자동 갱신 (Zero-Loading)
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}
