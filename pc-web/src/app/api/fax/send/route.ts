import { NextRequest, NextResponse } from 'next/server';

// ── 팝빌 초기화 (서버 사이드 전용) ──
let faxService: any = null;

function getPopbillFaxService() {
  if (faxService) return faxService;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const popbill = require('popbill');
    popbill.config({
      LinkID    : process.env.POPBILL_LINK_ID    || '',
      SecretKey : process.env.POPBILL_SECRET_KEY || '',
      IsTest    : process.env.POPBILL_IS_TEST === 'true',
      defaultErrorHandler: (err: any) => { console.error('[Popbill]', err); },
    });
    faxService = popbill.FaxService();
    return faxService;
  } catch (e) {
    console.error('[Popbill init error]', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file        = formData.get('file')        as File | null;
    const faxNumber   = formData.get('faxNumber')   as string | null;
    const senderNum   = formData.get('senderNum')   as string | null;  // 발신번호
    const receiveName = formData.get('receiveName') as string | null;
    const corpNum     = process.env.POPBILL_CORP_NUM || '';          // 사업자번호 10자리

    /* ── 입력값 검증 ── */
    if (!file || !faxNumber) {
      return NextResponse.json({ ok: false, message: '파일과 팩스 번호는 필수입니다.' }, { status: 400 });
    }
    if (!corpNum) {
      return NextResponse.json({ ok: false, message: 'POPBILL_CORP_NUM 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }

    const svc = getPopbillFaxService();
    if (!svc) {
      return NextResponse.json({ ok: false, message: '팝빌 서비스 초기화 실패. POPBILL_LINK_ID/POPBILL_SECRET_KEY를 확인해주세요.' }, { status: 500 });
    }

    /* ── 파일 → Buffer ── */
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer  = Buffer.from(arrayBuffer);

    /* ── 팩스 번호 정규화 (하이픈 제거) ── */
    const cleanFax = faxNumber.replace(/-/g, '');
    const cleanSender = (senderNum || '').replace(/-/g, '') || '07012345678';

    /* ── 팝빌 FAX 즉시 전송 ── */
    const result: string = await new Promise((resolve, reject) => {
      svc.sendFAXBinary(
        corpNum,           // 사업자번호
        cleanSender,       // 발신번호
        cleanFax,          // 수신번호
        receiveName || '', // 수신자명
        fileBuffer,        // 파일 Buffer
        file.name,         // 파일명
        null,              // 예약시간 (null = 즉시)
        '',                // 사용자 ID
        '',                // 제목
        '',                // 전송결과 URL
        function(receiptNum: string) { resolve(receiptNum); },
        function(err: any) { reject(err); }
      );
    });

    return NextResponse.json({ ok: true, receiptNum: result, message: '팩스 발송이 완료되었습니다.' });

  } catch (err: any) {
    console.error('[FAX API Error]', err);
    const msg = err?.message || err?.description || '팩스 발송 중 오류가 발생했습니다.';
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
