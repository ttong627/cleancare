/**
 * 크린케어시스템 APK → Firebase Storage 업로드 스크립트
 *
 * 실행 전 Firebase Console에서 Storage를 한 번 활성화해야 합니다:
 * https://console.firebase.google.com/project/cleancare-cf307/storage
 * (시작하기 버튼 클릭 → 위치 선택 → 완료)
 *
 * 실행: node upload-apk.js
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

const FIREBASE_TOOLS_PATH = 'C:/Users/ttong/AppData/Roaming/npm/node_modules/firebase-tools';
const APK_PATH = path.join(__dirname, 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');

// Firebase Storage 버킷 (Storage 콘솔에서 확인 가능)
const BUCKET = 'cleancare-cf307.firebasestorage.app';
const OBJECT_NAME = 'apk/cleancaresystem.apk';

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

async function uploadApk(token) {
  const fileBuffer = fs.readFileSync(APK_PATH);
  const mb = (fileBuffer.length / 1024 / 1024).toFixed(1);
  process.stdout.write(`  업로드 중 (${mb} MB)`);
  const dotTimer = setInterval(() => process.stdout.write('.'), 3000);

  const encodedName = encodeURIComponent(OBJECT_NAME);
  const res = await httpsRequest({
    hostname: 'storage.googleapis.com',
    path: `/upload/storage/v1/b/${encodeURIComponent(BUCKET)}/o?uploadType=media&name=${encodedName}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': fileBuffer.length,
    },
  }, fileBuffer);

  clearInterval(dotTimer);
  process.stdout.write('\n');

  if (res.status !== 200) {
    throw new Error(`업로드 실패 (${res.status}): ${res.body.substring(0, 200)}`);
  }
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

  if (res.status !== 200) {
    throw new Error(`공개 설정 실패 (${res.status}): ${res.body.substring(0, 200)}`);
  }
}

async function main() {
  if (!fs.existsSync(APK_PATH)) {
    throw new Error(`APK 파일이 없습니다: ${APK_PATH}\n먼저 flutter build apk --release 를 실행하세요.`);
  }

  console.log('\n크린케어시스템 APK 업로드\n');

  console.log('1) Firebase 인증 확인 중...');
  const token = await getToken();
  console.log('   완료');

  console.log('2) Firebase Storage 업로드 중...');
  await uploadApk(token);
  console.log('   완료');

  console.log('3) 공개 접근 설정 중...');
  await makePublic(token);
  console.log('   완료\n');

  const url = `https://storage.googleapis.com/${BUCKET}/${OBJECT_NAME}`;
  console.log('══════════════════════════════════════════════');
  console.log('  다운로드 URL (갤럭시 브라우저에서 열면 설치됨)');
  console.log('');
  console.log('  ' + url);
  console.log('');
  console.log('  QR코드 생성: https://qr.io (위 URL 붙여넣기)');
  console.log('══════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n오류:', err.message);
  if (err.message.includes('404') || err.message.includes('NoSuchBucket')) {
    console.log('\n※ Firebase Storage가 아직 활성화되지 않았습니다.');
    console.log('  아래 주소에서 "시작하기" 버튼을 클릭해 주세요:');
    console.log('  https://console.firebase.google.com/project/cleancare-cf307/storage\n');
  }
  process.exit(1);
});
