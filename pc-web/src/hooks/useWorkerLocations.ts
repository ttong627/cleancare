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
    const q = query(
      collection(db, 'systemUsers'),
      where('isGpsActive', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: WorkerLocationData[] = snap.docs
        .map(d => {
          const raw = d.data();
          return {
            uid: d.id,
            name: raw.name ?? '작업자',
            currentLat: raw.currentLat,
            currentLng: raw.currentLng,
            locationUpdatedAt: raw.locationUpdatedAt ?? 0,
            isGpsActive: raw.isGpsActive ?? false,
          };
        })
        .filter(w => w.currentLat != null && w.currentLng != null);
      setLocations(data);
    }, (err) => {
      // isGpsActive 인덱스 없을 때 폴백: 전체 조회 후 클라이언트 필터
      console.warn('[useWorkerLocations] 인덱스 없음, 폴백 사용:', err.message);
      const fallbackQ = query(collection(db, 'systemUsers'));
      onSnapshot(fallbackQ, (snap2) => {
        const data: WorkerLocationData[] = snap2.docs
          .map(d => {
            const raw = d.data();
            return {
              uid: d.id,
              name: raw.name ?? '작업자',
              currentLat: raw.currentLat,
              currentLng: raw.currentLng,
              locationUpdatedAt: raw.locationUpdatedAt ?? 0,
              isGpsActive: raw.isGpsActive ?? false,
            };
          })
          .filter(w => w.isGpsActive && w.currentLat != null && w.currentLng != null);
        setLocations(data);
      });
    });
    return () => unsub();
  }, []);

  return locations;
}
