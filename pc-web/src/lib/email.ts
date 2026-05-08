export async function sendEmail(payload: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: 'base64';
    contentType: string;
  }>;
}) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? '이메일 전송 실패');
  }
  return res.json();
}

export function approvalEmailHtml(userName: string, role: string): string {
  const roleLabel: Record<string, string> = {
    MASTER: '최고 관리자',
    ADMIN: '사무실무자',
    WORKER: '현장작업자',
  };
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(14,165,233,0.15);">
        <tr><td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">크린케어 통합 관제 시스템</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">계정 승인 완료 안내</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 24px;">
            안녕하세요, <strong style="color:#0ea5e9;">${userName}</strong>님.<br>
            크린케어 통합 관제 시스템에 대한 접근이 승인되었습니다.
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin:0 0 24px;">
            <p style="margin:0;color:#0369a1;font-size:14px;font-weight:700;">부여된 권한</p>
            <p style="margin:8px 0 0;color:#0ea5e9;font-size:22px;font-weight:800;">${roleLabel[role] ?? role}</p>
          </div>
          <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 32px;">
            이제 크린케어 시스템에 로그인하여 업무를 시작할 수 있습니다.<br>
            문의 사항이 있으시면 관리자에게 연락해 주세요.
          </p>
          <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://cleancare-cf307.web.app'}/login"
             style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
            시스템 로그인하기
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2025 크린케어. 이 메일은 자동 발송된 메일입니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function reportEmailHtml(projectName: string, workerName: string, completedAt: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(16,185,129,0.15);">
        <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">작업 완료 보고서</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">크린케어 통합 관제 시스템</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 24px;">
            안녕하세요.<br>아래 현장의 작업이 완료되었음을 알려드립니다.
          </p>
          <table width="100%" cellpadding="12" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;margin:0 0 24px;">
            <tr style="background:#f8fafc;">
              <td style="color:#64748b;font-size:13px;font-weight:600;width:120px;">현장명</td>
              <td style="color:#0f172a;font-size:14px;font-weight:700;">${projectName}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #e2e8f0;">담당 작업자</td>
              <td style="color:#0f172a;font-size:14px;border-top:1px solid #e2e8f0;">${workerName}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #e2e8f0;">완료 일시</td>
              <td style="color:#0f172a;font-size:14px;border-top:1px solid #e2e8f0;">${completedAt}</td>
            </tr>
          </table>
          <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">
            첨부된 PDF 파일에서 상세 작업 보고서를 확인하실 수 있습니다.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2025 크린케어. 이 메일은 자동 발송된 메일입니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
