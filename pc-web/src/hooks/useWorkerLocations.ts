import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface WorkerLocationData {
  uid: string;
  name: string;
  currentLat: number;
  currentLng: number;
  locationUpdatedAt: number;
  isGpsActive: boolean;
}

export function useWorkerLocations() {
  const [locations, setLocations] = useState<WorkerLocationData[]>([]);

  useEffect(() => {
    // isGpsActive 인덱스가 없을 때를 대비한 폴백 패턴
    // 첫 번째 구독이 실패하면 두 번째 구독으로 대체
    let unsubscribe: (() => void) | null = null;
    let settled = false;

    const handleData = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => {
      const data: WorkerLocationData[] = docs
        .map(d => {
          const raw = d.data();
          return {
            uid: d.id,
            name: (raw.name as string) ?? '작업자',
            currentLat: raw.currentLat as number,
            currentLng: raw.currentLng as number,
            locationUpdatedAt: (raw.locationUpdatedAt as number) ?? 0,
            isGpsActive: (raw.isGpsActive as boolean) ?? false,
          };
        })
        .filter(w => w.isGpsActive && w.currentLat != null && w.currentLng != null);
      setLocations(data);
    };

    try {
      const q = query(
        collection(db, 'systemUsers'),
        where('isGpsActive', '==', true)
      );
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          settled = true;
          handleData(snap.docs);
        },
        () => {
          // 인덱스 오류 시 전체 조회 폴백
          if (settled) return;
          if (unsubscribe) { unsubscribe(); unsubscribe = null; }
          const fallbackQ = query(collection(db, 'systemUsers'));
          unsubscribe = onSnapshot(fallbackQ, (snap2) => {
            handleData(snap2.docs);
          });
        }
      );
    } catch {
      const fallbackQ = query(collection(db, 'systemUsers'));
      unsubscribe = onSnapshot(fallbackQ, (snap) => {
        handleData(snap.docs);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return locations;
}
