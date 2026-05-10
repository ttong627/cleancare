/**
 * 크린케어시스템 — APK + 사용설명서 일괄 업로드
 * 실행: node upload-all.js
 */

const path = require('path');
const fs   = require('fs');
const https = require('https');
const os   = require('os');

const FIREBASE_TOOLS_PATH = 'C:/Users/ttong/AppData/Roaming/npm/node_modules/firebase-tools';
const BUCKET = 'cleancare-cf307.firebasestorage.app';

const UPLOADS = [
  {
    label: 'APK (앱 설치 파일)',
    localPath: path.join(__dirname, 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
    objectName: 'apk/cleancaresystem.apk',
    contentType: 'application/vnd.android.package-archive',
  },
  {
    label: '사용설명서 (HTML)',
    localPath: path.join(__dirname, '사용설명서.html'),
    objectName: 'manual/index.html',
    contentType: 'text/html; charset=utf-8',
  },
];

// ── HTTP helper ──────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── 토큰 취득 (firebase-tools API → configstore 직접 읽기 순서로 시도) ────────

async function getToken() {
  // configstore에서 access_token 직접 읽기 (firebase login 직후 항상 유효)
  const configPaths = [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Configstore', 'firebase-tools.json'),
  ];

  let config;
  for (const p of configPaths) {
    if (fs.existsSync(p)) { config = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
  }
  if (!config) throw new Error('Firebase 자격증명 파일을 찾을 수 없습니다.\n  → firebase login --reauth 를 다시 실행하세요.');

  // access_token 직접 추출
  const candidates = [
    config.tokens,
    config.user?.tokens,
    ...(config.users ? Object.values(config.users).map(u => u?.tokens) : []),
  ];
  const tokens = candidates.find(t => t?.access_token);
  if (!tokens?.access_token) throw new Error('access_token을 찾을 수 없습니다.\n  → firebase login --reauth 를 다시 실행하세요.');

  // 만료 시각 확인 (expires_at 또는 expiry_date, ms 단위)
  const expiresAt = tokens.expires_at || tokens.expiry_date || 0;
  if (expiresAt && Date.now() > expiresAt - 60000) {
    // 만료 임박 → refresh_token으로 갱신
    if (!tokens.refresh_token) throw new Error('토큰이 만료되었습니다.\n  → firebase login --reauth 를 다시 실행하세요.');
    return await refreshToken(tokens.refresh_token);
  }

  console.log('   (configstore access_token 직접 사용)');
  return tokens.access_token;
}

async function refreshToken(refreshTok) {
  // firebase-tools api.js에서 clientSecret 읽기
  let cid  = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
  let csec = 'j9iVZfS8kkCEFUPaAeJV0sAi';
  try {
    const api = require(FIREBASE_TOOLS_PATH + '/lib/api.js');
    if (typeof api.clientId     === 'function') cid  = api.clientId();
    else if (api.clientId)                      cid  = api.clientId;
    if (typeof api.clientSecret === 'function') csec = api.clientSecret();
    else if (api.clientSecret)                  csec = api.clientSecret;
  } catch (_) {}

  const body = [
    'grant_type=refresh_token',
    `client_id=${encodeURIComponent(cid)}`,
    `client_secret=${encodeURIComponent(csec)}`,
    `refresh_token=${encodeURIComponent(refreshTok)}`,
  ].join('&');

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);

  if (res.status !== 200) throw new Error(`토큰 갱신 실패 (${res.status})\n  → firebase login --reauth 후 다시 실행하세요.`);
  console.log('   (refresh_token으로 갱신 완료)');
  return JSON.parse(res.body).access_token;
}

// ── 파일 업로드 ──────────────────────────────────────────────────────────────

async function uploadFile(token, { label, localPath, objectName, contentType }) {
  if (!fs.existsSync(localPath)) throw new Error(`파일 없음: ${localPath}`);
  const buf  = fs.readFileSync(localPath);
  const size = buf.length > 1024 * 1024
    ? (buf.length / 1024 / 1024).toFixed(1) + ' MB'
    : (buf.length / 1024).toFixed(0) + ' KB';

  process.stdout.write(`  [${label}] 업로드 중 (${size})`);
  const timer = setInterval(() => process.stdout.write('.'), 2000);

  const res = await httpsRequest({
    hostname: 'storage.googleapis.com',
    path: `/upload/storage/v1/b/${encodeURIComponent(BUCKET)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': buf.length,
    },
  }, buf);

  clearInterval(timer);
  process.stdout.write(' 완료\n');
  if (res.status !== 200) throw new Error(`업로드 실패 (${res.status}): ${res.body.substring(0, 300)}`);
}

// ── Firebase Storage 다운로드 토큰 취득 ─────────────────────────────────────

async function getDownloadToken(token, objectName) {
  const res = await httpsRequest({
    hostname: 'firebasestorage.googleapis.com',
    path: `/v0/b/${encodeURIComponent(BUCKET)}/o/${encodeURIComponent(objectName)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (res.status === 200) {
    const d = JSON.parse(res.body);
    return d.downloadTokens ? d.downloadTokens.split(',')[0] : null;
  }
  return null;
}

function makeFirebaseUrl(objectName, dlToken) {
  const base = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(BUCKET)}/o/${encodeURIComponent(objectName)}?alt=media`;
  return dlToken ? `${base}&token=${dlToken}` : base;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  크린케어시스템 서버 업로드');
  console.log('══════════════════════════════════════════════\n');

  console.log('1) Firebase 인증 확인 중...');
  const token = await getToken();
  console.log('   ✓ 인증 완료\n');

  const results = [];
  for (let i = 0; i < UPLOADS.length; i++) {
    const item = UPLOADS[i];
    console.log(`${i + 2}) ${item.label} 업로드 중...`);
    await uploadFile(token, item);
    const dlToken = await getDownloadToken(token, item.objectName);
    results.push({ ...item, dlToken });
    console.log(`   ✓ 완료\n`);
  }

  console.log('══════════════════════════════════════════════');
  console.log('  업로드 완료! 접속 링크\n');
  for (const item of results) {
    console.log(`  [${item.label}]`);
    console.log(`  ${makeFirebaseUrl(item.objectName, item.dlToken)}\n`);
  }
  console.log('  QR코드: https://qr.io 에서 URL 붙여넣기');
  console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n오류:', err.message);
  process.exit(1);
});
