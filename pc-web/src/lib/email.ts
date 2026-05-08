import emailjs from '@emailjs/browser';

const SERVICE_ID  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID  ?? '';
const PUBLIC_KEY  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY  ?? '';
const APPROVAL_TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_APPROVAL_TEMPLATE ?? '';
const REPORT_TEMPLATE   = process.env.NEXT_PUBLIC_EMAILJS_REPORT_TEMPLATE   ?? '';

function isEmailJsConfigured() {
  return SERVICE_ID && PUBLIC_KEY && APPROVAL_TEMPLATE && REPORT_TEMPLATE;
}

export async function sendApprovalEmail(params: {
  to_email: string;
  to_name: string;
  role_label: string;
}): Promise<void> {
  if (!isEmailJsConfigured()) {
    // EmailJS 미설정 시 mailto: 폴백
    const subject = encodeURIComponent('[크린케어] 계정 승인이 완료되었습니다');
    const body = encodeURIComponent(
      `안녕하세요, ${params.to_name}님.\n\n크린케어 시스템 접근이 승인되었습니다.\n부여된 권한: ${params.role_label}\n\n시스템에 로그인하여 업무를 시작하세요.`
    );
    window.open(`mailto:${params.to_email}?subject=${subject}&body=${body}`);
    return;
  }
  await emailjs.send(SERVICE_ID, APPROVAL_TEMPLATE, params, { publicKey: PUBLIC_KEY });
}

export async function sendReportEmail(params: {
  to_email: string;
  project_name: string;
  worker_name: string;
  completed_at: string;
}): Promise<void> {
  if (!isEmailJsConfigured()) {
    const subject = encodeURIComponent(`[크린케어] ${params.project_name} 작업 완료 보고`);
    const body = encodeURIComponent(
      `안녕하세요.\n\n현장명: ${params.project_name}\n담당 작업자: ${params.worker_name}\n완료 일시: ${params.completed_at}\n\n상세 내용은 시스템에서 확인해 주세요.`
    );
    window.open(`mailto:${params.to_email}?subject=${subject}&body=${body}`);
    return;
  }
  await emailjs.send(SERVICE_ID, REPORT_TEMPLATE, params, { publicKey: PUBLIC_KEY });
}

// 하위 호환성 — 기존 sendEmail 호출부가 있다면 이 함수로 래핑
export async function sendEmail(payload: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  const to = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  const subjectEnc = encodeURIComponent(payload.subject);
  const bodyText = payload.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const bodyEnc = encodeURIComponent(bodyText.slice(0, 1800));
  window.open(`mailto:${to}?subject=${subjectEnc}&body=${bodyEnc}`);
}

export function approvalEmailHtml(userName: string, role: string): string {
  const roleLabel: Record<string, string> = {
    MASTER: '최고 관리자', ADMIN: '사무실무자', WORKER: '현장작업자',
  };
  return `<p>${userName}님의 권한이 <strong>${roleLabel[role] ?? role}</strong>로 승인되었습니다.</p>`;
}

export function reportEmailHtml(projectName: string, workerName: string, completedAt: string): string {
  return `<p>현장 <strong>${projectName}</strong> — 담당 작업자 ${workerName}, 완료 일시 ${completedAt}</p>`;
}
