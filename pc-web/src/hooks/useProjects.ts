import { useEffect, useState } from 'react';
import { collection, doc, updateDoc, onSnapshot, query, setDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ProjectStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface ProjectData {
  id: string;
  name: string;
  workerName: string;
  status: ProjectStatus;
  rejectReason?: string;
  timeElapsed?: string;
  createdAt?: number;
}

// 웹소켓(Firestore Listener) 기반 무지연 실시간 알림 적용 (V2.0 설계서 반영)
export function useProjects() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef);

    // 실시간 구독 (onSnapshot)
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        if (snapshot.empty) {
          // DB가 비어있으면 데이터가 없는 상태 그대로 유지 (삭제한 내용이 부활하지 않도록 조치)
          setProjects([]);
          setIsLoading(false);
          return;
        }

        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ProjectData));
        
        // 생성일 기준 내림차순 정렬 (최신이 위로)
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        setProjects(data);
        setIsLoading(false);
      } catch (err) {
        console.error("실시간 동기화 에러:", err);
        setError(err as Error);
        setIsLoading(false);
      }
    }, (err) => {
      console.error("Firestore 구독 에러:", err);
      setError(err);
      setIsLoading(false);
    });

    // 컴포넌트 언마운트 시 구독 해제 (메모리 누수 방지)
    return () => unsubscribe();
  }, []);

  return { data: projects, isLoading, error };
}

// 상태 변경 훅 (강제 재시작 등)
export function useUpdateProjectStatus() {
  const [isPending, setIsPending] = useState(false);

  const mutate = async ({ id, status }: { id: string, status: ProjectStatus }) => {
    setIsPending(true);
    try {
      const projectRef = doc(db, 'projects', id);
      await updateDoc(projectRef, {
        status: status,
        rejectReason: null // 상태 변경 시 반려 사유 초기화
      });
      // 성공 시 onSnapshot이 자동으로 화면을 갱신하므로 별도의 쿼리 무효화(invalidate)가 필요 없음
    } catch (error) {
      console.error("상태 업데이트 실패:", error);
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending };
}

// 최초 1회 빈 DB에 가상 데이터를 심어주는 헬퍼 함수
async function seedMockData() {
  const snapshot = await getDocs(collection(db, 'projects'));
  if (!snapshot.empty) return; // 이중 실행 방지

  const MOCK_DATA: ProjectData[] = [
    { id: 'p1', name: '수원 광교중학교 에어컨 세척', workerName: '김철수', status: 'REJECTED', rejectReason: 'AI 구도 불일치로 반려됨', timeElapsed: '30분 경과', createdAt: Date.now() },
    { id: 'p2', name: '판교 테크원타워 로비 청소', workerName: '이영희', status: 'REJECTED', rejectReason: '작업 구역 누락', timeElapsed: '1시간 경과', createdAt: Date.now() - 1000 },
    { id: 'p3', name: '강남역 지하상가 환풍구 정비', workerName: '박지민', status: 'REJECTED', rejectReason: '현장 조도 불량으로 식별 불가', timeElapsed: '15분 경과', createdAt: Date.now() - 2000 },
    { id: 'p4', name: '용인 처인구 LH 아파트 방역', workerName: '정민수', status: 'IN_PROGRESS', createdAt: Date.now() - 3000 },
    { id: 'p5', name: '성남 시청 부속실 청소', workerName: '최수진', status: 'IN_PROGRESS', createdAt: Date.now() - 4000 },
    { id: 'p6', name: '분당 정자초등학교 방역', workerName: '김철수', status: 'COMPLETED', createdAt: Date.now() - 5000 },
    { id: 'p7', name: '수지구청 식당 후드 청소', workerName: '이영희', status: 'COMPLETED', createdAt: Date.now() - 6000 },
  ];

  for (const item of MOCK_DATA) {
    const { id, ...data } = item;
    await setDoc(doc(db, 'projects', id), data);
  }
}
