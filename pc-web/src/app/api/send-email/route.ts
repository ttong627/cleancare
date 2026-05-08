import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    encoding: 'base64';
    contentType: string;
  }>;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload: SendEmailPayload = await req.json();
    const { to, subject, html, attachments } = payload;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: '필수 항목 누락 (to, subject, html)' }, { status: 400 });
    }

    const transport = createTransport();

    if (!transport) {
      // SMTP 미설정 시 콘솔 로그만 (개발 환경 폴백)
      console.log('[이메일 미전송 — SMTP 미설정]\n수신:', to, '\n제목:', subject);
      return NextResponse.json({ success: true, mode: 'console-only' });
    }

    const fromName = process.env.SMTP_FROM_NAME ?? '크린케어';
    const fromAddr = process.env.SMTP_USER;

    await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments,
    });

    return NextResponse.json({ success: true, mode: 'sent' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[이메일 전송 오류]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
