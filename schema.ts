// ==========================================
// 크린케어(Clean Care) V3.0 통합 데이터베이스 스키마
// ==========================================

export type UserRole = 'MASTER' | 'ADMIN' | 'WORKER' | 'OFFICIAL';

// 1. 거래처 및 담당자 스키마 (Clients)
export interface ClientManager {
  id: string;                  // 담당자 고유 ID
  name: string;                // 담당자명
  email: string;               // 담당자 이메일 (세금계산서 수신용 필수)
  contact: string;             // 담당자 연락처
  memo?: string;               // 비고
}

export interface Client {
  id: string;                  // 거래처 문서 ID
  businessNumber: string;      // 사업자등록번호
  name: string;                // 거래처명
  managers: ClientManager[];   // 거래처별 담당자 목록 (복수 가능)
  createdAt: number;
  updatedAt: number;
}

// 2. 세금계산서 발행 내역 (Invoices)
export interface Invoice {
  id: string;                  // 문서 ID
  projectId?: string;          // 연관된 현장 프로젝트 ID (일괄/단건 연동 시)
  clientId: string;            // 거래처 ID
  clientName: string;          // 거래처명
  businessNumber: string;      // 사업자등록번호
  managerName: string;         // 수신 담당자명
  managerEmail: string;        // 수신 담당자 이메일 (필수)
  itemName: string;            // 품명 (기본값: 현장명)
  amount: number;              // 공급가액
  status: 'ISSUED' | 'FAILED' | 'PENDING';
  issuedAt: number;            // 발행 일시
}

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
export type PhotoRequirement = 'BEFORE_AFTER' | 'BEFORE_DURING_AFTER';

export interface ProjectData {
  id: string;                  // 문서 ID
  name: string;                // 현장명 (예: "광교중학교 에어컨 세척")
  region: string;              // 지역 (예: "수원시") - 공무원 권한 매핑용
  
  // 📍 신규 추가: 일정 및 현장 세부 정보
  address: string;             // 작업장 상세 주소 (예: "경기도 수원시 영통구 광교로 123")
  coordinates?: {              // 자동 변환된 카카오맵 좌표 (위도/경도)
    lat: number;
    lng: number;
  };
  clientManager?: string;      // 현장 담당자 이름
  clientContact?: string;      // 현장 담당자 연락처
  scheduledDate: string;       // 배정된 날짜 (YYYY-MM-DD 형식, 캘린더 연동용)
  taskDetails?: string;        // 작업 세부 내용
  photoRequirement: PhotoRequirement; // 사진 촬영 필수 단계
  memo?: string;               // 비고
  
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
  duringImages?: string[];     // 작업 중 사진 (전중후 모드일 경우)
  afterImages: string[];       // 작업 후 증빙
  
  createdAt: number;
  updatedAt: number;
}
