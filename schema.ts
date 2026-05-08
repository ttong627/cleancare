// ==========================================
// 크린케어(Clean Care) V3.0 통합 데이터베이스 스키마
// ==========================================

export type UserRole = 'MASTER' | 'ADMIN' | 'WORKER' | 'OFFICIAL';

// 1. 사용자 (Users) 스키마
export interface User {
  uid: string;                 // Firebase Auth UID
  email: string;               // 로그인 이메일 (마스터/관리자/공무원)
  phoneNumber?: string;        // 휴대폰 번호 (현장실무자 로그인 및 알림용)
  name: string;                // 실명
  role: UserRole;              // 권한 계층
  
  // 권한별 세부 속성
  department?: string;         // 소속 (예: "수원시 교육청", "크린케어 본사")
  assignedRegion?: string;     // 담당 지역 (공무원 전용 조회 권한)
  
  isActive: boolean;           // 계정 활성화 여부
  createdAt: number;
  lastLoginAt: number;
}

// 2. 프로젝트 (Projects) 스키마
export type ProjectStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface ProjectData {
  id: string;                  // 문서 ID
  name: string;                // 현장명 (예: "광교중학교 에어컨 세척")
  region: string;              // 지역 (예: "수원시") - 공무원 권한 매핑용
  
  // 상태 및 담당자
  status: ProjectStatus;
  workerId: string;            // 배정된 현장실무자 UID
  workerName: string;          // 작업자 이름 (캐싱용)
  officialId?: string;         // 담당 공무원 UID (선택)
  
  // 시간 및 거절 사유
  timeElapsed?: string;        
  rejectReason?: string | null;
  
  // 정산 및 증빙 정보
  price: number;               // 청구 금액 (마스터/관리자만 열람 가능)
  invoiceIssued: boolean;      // 세금계산서 발행 여부
  faxSent: boolean;            // 팩스 발송 여부
  
  // AR 증빙 사진 URL (배열)
  beforeImages: string[];      // 작업 전 사진/도면
  afterImages: string[];       // 작업 후 증빙
  
  createdAt: number;
  updatedAt: number;
}
