// pc-web/src/types/schema.ts
// 기존 스키마에서 타임스탬프, 작업자ID, 반려사유 등 누락된 핵심 데이터를 보강한 100% 완성 코드입니다.

export type Role = 'ADMIN' | 'WORKER';
export type ProjectStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
export type MarkerStatus = 'PENDING' | 'COMPLETED' | 'REJECTED';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: Role;
  createdAt: number;
}

export interface Project {
  projectId: string;
  workerId: string; // 추가: 할당된 작업자 ID
  clientInfo: {
    type: 'SCHOOL' | 'LH' | 'OTHER';
    name: string;
  };
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  weather: {
    temp: number;
    condition: string;
  };
  markers: Marker[];
  status: ProjectStatus;
  rejectReason?: string; // 추가: 반려 사유
  createdAt: number;     // 추가: 생성 시간 (동기화 충돌 방지용)
  updatedAt: number;     // 추가: 수정 시간
}

export interface Marker {
  id: string;
  pos: { x: number; y: number };
  status: MarkerStatus;
  photos: {
    before?: string;
    during?: string;
    after?: string;
  };
  updatedAt: number;     // 추가: 마커 개별 동기화 시간
}
