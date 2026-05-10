'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Upload, Trash2, Loader2, Plus, Search, Eye, Download,
  FolderOpen, AlertCircle, CheckCircle2, X, File, FileImage,
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import toast from 'react-hot-toast';

/* ── 타입 ── */
interface CompanyDocument {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadURL: string;
  storagePath: string;
  uploadedAt: number;
  uploadedBy: string;
}

/* ── 파일 아이콘 ── */
function DocIcon({ type, size = 20 }: { type: string; size?: number }) {
  if (type.startsWith('image/')) return <FileImage size={size} className="text-blue-400" />;
  if (type === 'application/pdf') return <FileText size={size} className="text-red-400" />;
  return <File size={size} className="text-slate-400" />;
}

/* ══════════════ 메인 페이지 ══════════════ */
export default function CompanyDocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null);

  // 업로드 모달 상태
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firestore 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'companyDocuments'),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyDocument));
        docs.sort((a, b) => b.uploadedAt - a.uploadedAt);
        setDocuments(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error('[companyDocuments 구독 오류]', err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 검색 필터링
  const filtered = documents.filter(d =>
    searchQuery.trim() === '' ? true :
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 파일 업로드 핸들러
  const handleUpload = useCallback(async () => {
    if (!uploadFile) { toast.error('파일을 선택해주세요.'); return; }
    if (!uploadDocName.trim()) { toast.error('서류명을 입력해주세요.'); return; }

    setUploading(true);
    const toastId = toast.loading('서류 업로드 중...');

    try {
      const ext = uploadFile.name.split('.').pop() ?? 'bin';
      const storagePath = `companyDocuments/${Date.now()}_${uploadFile.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, uploadFile);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'companyDocuments'), {
        name: uploadDocName.trim(),
        fileName: uploadFile.name,
        fileType: uploadFile.type || `application/${ext}`,
        fileSize: uploadFile.size,
        downloadURL,
        storagePath,
        uploadedAt: Date.now(),
        uploadedBy: '관리자',
      });

      toast.success(`[${uploadDocName}] 서류가 등록되었습니다.`, { id: toastId });
      setShowUploadModal(false);
      setUploadDocName('');
      setUploadFile(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('업로드 실패: ' + msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadDocName]);

  // 삭제 핸들러
  const handleDelete = async (d: CompanyDocument) => {
    if (!confirm(`[${d.name}] 서류를 삭제하시겠습니까?\n모바일 앱에서도 더 이상 표시되지 않습니다.`)) return;
    setDeletingId(d.id);
    try {
      await deleteObject(ref(storage, d.storagePath));
      await deleteDoc(doc(db, 'companyDocuments', d.id));
      toast.success(`[${d.name}] 서류가 삭제되었습니다.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('삭제 실패: ' + msg);
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-8 min-h-screen flex flex-col max-w-6xl">
      {/* 헤더 */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-400/30">
              <FolderOpen className="text-white" size={24} />
            </div>
            회사 서류 관리
          </h1>
          <p className="text-slate-400">
            사업자등록증, 인증서, 영업필증 등 필수 서류를 등록하면 모바일 앱에서 즉시 팩스 발송이 가능합니다.
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-violet-500/30 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> 새 서류 등록
        </button>
      </header>

      {/* 검색 바 */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="서류명 검색 (예: 사업자등록증, 영업필증)..."
          className="w-full pl-12 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* 안내 카드 */}
      <div className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-start gap-3">
        <AlertCircle size={20} className="text-violet-400 mt-0.5 shrink-0" />
        <div className="text-sm text-violet-300">
          <strong>이 시스템의 동작 원리:</strong> 여기서 등록한 서류는 Firebase 클라우드에 안전하게 보관되며,
          현장 작업자의 모바일 앱 <strong>[현장 즉시 팩스 발송]</strong> 화면에 실시간으로 동기화됩니다.
          작업자가 서류를 선택하면 스마트폰으로 자동 다운로드 후 팩스 전송이 수행됩니다.
        </div>
      </div>

      {/* 서류 목록 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> 서류 목록 불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20">
          <FolderOpen size={64} className="mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 서류가 없습니다.'}
          </p>
          {!searchQuery && (
            <p className="text-sm mt-2">상단의 [새 서류 등록] 버튼으로 첫 번째 서류를 올려보세요.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => (
            <div
              key={d.id}
              className="bg-slate-800/60 border border-slate-700 hover:border-violet-500/50 rounded-2xl p-5 transition-all group hover:shadow-lg hover:shadow-violet-500/10"
            >
              {/* 상단: 아이콘 + 서류명 */}
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 group-hover:border-violet-500/30 transition-colors">
                  <DocIcon type={d.fileType} size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base truncate">{d.name}</h3>
                  <p className="text-slate-500 text-xs truncate mt-0.5">{d.fileName}</p>
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                <span>{formatFileSize(d.fileSize)}</span>
                <span>·</span>
                <span>{new Date(d.uploadedAt).toLocaleDateString('ko-KR')}</span>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewDoc(d)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye size={14} /> 미리보기
                </button>
                <a
                  href={d.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => handleDelete(d)}
                  disabled={deletingId === d.id}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deletingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 통계 바 */}
      {documents.length > 0 && (
        <div className="mt-6 flex items-center gap-4 text-sm text-slate-500 border-t border-slate-800 pt-4">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-violet-400" />
            등록된 서류 총 <strong className="text-violet-300">{documents.length}</strong>건
          </span>
          <span>·</span>
          <span>모바일 앱에 실시간 동기화 중</span>
        </div>
      )}

      {/* ══ 새 서류 업로드 모달 ══ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="text-violet-400" size={22} /> 새 서류 등록
              </h2>
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadDocName(''); }} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* 서류 종류명 */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-400 mb-2">서류 종류명 *</label>
              <input
                value={uploadDocName}
                onChange={e => setUploadDocName(e.target.value)}
                placeholder="예: 사업자등록증, 건물위생관리업영업필증"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-none focus:border-violet-500 transition-colors"
              />
              {/* 자주 쓰는 서류명 빠른 선택 */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  '사업자등록증', '사회적기업인증서', '자활기업인정서', '여성기업인증서',
                  '직접생산 증명서', '통장사본', '중소기업확인서',
                  '건물위생관리업영업필증', '저수조청소업영업필증', '소독방역업영업필증',
                ].map(name => (
                  <button
                    key={name}
                    onClick={() => setUploadDocName(name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      uploadDocName === name
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/30 hover:text-violet-300'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* 파일 선택 */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-400 mb-2">파일 선택 *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.hwp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setUploadFile(f);
                  e.target.value = '';
                }}
              />
              {uploadFile ? (
                <div className="flex items-center gap-3 p-4 bg-slate-800 border border-violet-500/30 rounded-xl">
                  <DocIcon type={uploadFile.type} size={24} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{uploadFile.name}</p>
                    <p className="text-slate-500 text-xs">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <button onClick={() => setUploadFile(null)} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-slate-700 hover:border-violet-500/50 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:text-violet-300 transition-colors"
                >
                  <Upload size={28} />
                  <span className="text-sm font-medium">클릭하여 파일 선택</span>
                  <span className="text-xs text-slate-500">PDF, 이미지(JPG/PNG), HWP 지원 · 최대 20MB</span>
                </button>
              )}
            </div>

            {/* 업로드 버튼 */}
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadDocName.trim()}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? <><Loader2 size={18} className="animate-spin" /> 업로드 중...</> : <><Upload size={18} /> 서류 등록 완료</>}
            </button>
          </div>
        </div>
      )}

      {/* ══ 미리보기 모달 ══ */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <DocIcon type={previewDoc.fileType} size={22} />
                <div>
                  <h2 className="text-white font-bold">{previewDoc.name}</h2>
                  <p className="text-xs text-slate-500">{previewDoc.fileName} · {formatFileSize(previewDoc.fileSize)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <Download size={18} />
                </a>
                <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950">
              {previewDoc.fileType.startsWith('image/') ? (
                <img src={previewDoc.downloadURL} alt={previewDoc.name} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
              ) : previewDoc.fileType === 'application/pdf' ? (
                <iframe src={previewDoc.downloadURL} title={previewDoc.name} className="w-full h-full rounded-lg border border-slate-700" style={{ minHeight: 600 }} />
              ) : (
                <div className="text-center text-slate-400">
                  <FileText size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">이 파일 형식은 미리보기가 지원되지 않습니다.</p>
                  <a href={previewDoc.downloadURL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-violet-400 underline">
                    파일 다운로드
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
