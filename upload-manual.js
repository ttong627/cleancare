/**
 * 크린케어시스템 사용설명서 → Firebase Storage 업로드 스크립트
 * 실행: node upload-manual.js
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

const FIREBASE_TOOLS_PATH = 'C:/Users/ttong/AppData/Roaming/npm/node_modules/firebase-tools';
const MANUAL_PATH = path.join(__dirname, '사용설명서.html');

const BUCKET = 'cleancare-cf307.firebasestorage.app';
const OBJECT_NAME = 'manual/index.html';

async function getToken() {
  const auth = require(FIREBASE_TOOLS_PATH + '/lib/auth.js');
  const account = auth.getGlobalDefaultAccount();
  const result = await auth.getAccessToken(account, []);
  return result.access_token;
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadFile(token) {
  const fileBuffer = fs.readFileSync(MANUAL_PATH);
  const kb = (fileBuffer.length / 1024).toFixed(0);
  process.stdout.write(`  업로드 중 (${kb} KB)...`);

  const encodedName = encodeURIComponent(OBJECT_NAME);
  const res = await httpsRequest({
    hostname: 'storage.googleapis.com',
    path: `/upload/storage/v1/b/${encodeURIComponent(BUCKET)}/o?uploadType=media&name=${encodedName}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': fileBuffer.length,
    },
  }, fileBuffer);

  process.stdout.write(' 완료\n');
  if (res.status !== 200) throw new Error(`업로드 실패 (${res.status}): ${res.body.substring(0, 200)}`);
  return JSON.parse(res.body);
}

async function makePublic(token) {
  const encodedName = encodeURIComponent(OBJECT_NAME);
  const body = JSON.stringify({ role: 'READER', entity: 'allUsers' });
  const res = await httpsRequest({
    hostname: 'storage.googleapis.com',
    path: `/storage/v1/b/${encodeURIComponent(BUCKET)}/o/${encodedName}/acl`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) throw new Error(`공개 설정 실패 (${res.status}): ${res.body.substring(0, 200)}`);
}

async function main() {
  if (!fs.existsSync(MANUAL_PATH)) {
    throw new Error(`사용설명서.html 파일이 없습니다: ${MANUAL_PATH}`);
  }

  console.log('\n크린케어시스템 사용설명서 업로드\n');

  console.log('1) Firebase 인증 확인 중...');
  const token = await getToken();
  console.log('   완료');

  console.log('2) Firebase Storage 업로드 중...');
  await uploadFile(token);
  console.log('   완료');

  console.log('3) 공개 접근 설정 중...');
  await makePublic(token);
  console.log('   완료\n');

  const url = `https://storage.googleapis.com/${BUCKET}/${OBJECT_NAME}`;
  console.log('══════════════════════════════════════════════');
  console.log('  사용설명서 URL (브라우저에서 바로 열립니다)');
  console.log('');
  console.log('  ' + url);
  console.log('');
  console.log('  QR코드 생성: https://qr.io (위 URL 붙여넣기)');
  console.log('══════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n오류:', err.message);
  if (err.message.includes('credentials no longer valid') || err.message.includes('401')) {
    console.log('\n※ Firebase 인증이 만료되었습니다.');
    console.log('  아래 명령어로 재인증 후 다시 실행하세요:');
    console.log('  firebase login --reauth\n');
  }
  process.exit(1);
});
