import { useEffect, useState, useCallback } from 'react';
import { collection, doc, updateDoc, onSnapshot, query } from 'firebase/firestore';
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
  updatedAt?: number;
  price?: number;
  invoiceIssued?: boolean;
  address?: string;
  clientName?: string;
  manager?: string;
  contact?: string;
  memo?: string;
  workerId?: string;
  clientId?: string;
  photos?: Array<{
    url: string;
    type: 'before' | 'after' | 'process';
    uploadedAt: number;
    uploadedBy: string;
    storagePath: string;
  }>;
  lat?: number;
  lng?: number;
}

// 실시간 구독 훅 (onSnapshot 기반, 무지연 Zero-Loading)
export function useProjects() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ProjectData));

        // 최신순 정렬 (생성일 내림차순)
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setProjects(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('[useProjects] Firestore 구독 오류:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { data: projects, isLoading, error };
}

// 상태 변경 훅
export function useUpdateProjectStatus() {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(async ({ id, status, rejectReason }: { id: string; status: ProjectStatus; rejectReason?: string }) => {
    setIsPending(true);
    try {
      await updateDoc(doc(db, 'projects', id), {
        status,
        rejectReason: rejectReason ?? null,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[useUpdateProjectStatus] 상태 업데이트 실패:', error);
      throw error;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { mutate, isPending };
}
