'use client';

import { useState, useRef } from 'react';
import { X, FileText, Printer, Mail, Calculator, Upload, Camera, Trash2, Loader2, Image as ImageIcon, MapPin, AlertCircle, Clock, StickyNote } from 'lucide-react';
import toast from 'react-hot-toast';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { ProjectData, ArSpotData, ExtraPhotoData } from '@/hooks/useProjects';
import { sendReportEmail } from '@/lib/email';
import InvoiceIssueModal from '@/components/InvoiceIssueModal';

interface ProjectDetailsModalProps {
  project: ProjectData | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserName?: string;
}

type PhotoType = 'before' | 'after' | 'process';

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  before: '작업 전',
  after: '작업 후',
  process: '작업 중',
};

const PHOTO_TYPE_COLORS: Record<PhotoType, string> = {
  before: '#0ea5e9',
  after: '#10b981',
  process: '#f59e0b',
};

export default function ProjectDetailsModal({ project, isOpen, onClose, currentUserName }: ProjectDetailsModalProps) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoType, setPendingPhotoType] = useState<PhotoType>('before');

  if (!isOpen || !project) return null;

  const photos = project.photos ?? [];

  const handleUploadClick = (type: PhotoType) => {
    setPendingPhotoType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';

    const type = pendingPhotoType;
    setUploadingType(type);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const storagePath = `projects/${project.id}/${type}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const newPhoto = {
        url,
        type,
        uploadedAt: Date.now(),
        uploadedBy: currentUserName ?? '관리자',
        storagePath,
      };

      await updateDoc(doc(db, 'projects', project.id), {
        photos: [...photos, newPhoto],
      });

      toast.success(`${PHOTO_TYPE_LABELS[type]} 사진이 업로드되었습니다.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('사진 업로드 실패: ' + msg);
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeletePhoto = async (storagePath: string) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    setDeletingPath(storagePath);
    try {
      await deleteObject(ref(storage, storagePath));
      const updated = photos.filter(p => p.storagePath !== storagePath);
      await updateDoc(doc(db, 'projects', project.id), { photos: updated });
      toast.success('사진이 삭제되었습니다.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('사진 삭제 실패: ' + msg);
    } finally {
      setDeletingPath(null);
    }
  };

  const handleSendReportEmail = async () => {
    if (!project.contact && !project.manager) {
      toast.error('담당자 이메일 정보가 없습니다.');
      return;
    }
    const emailAddr = project.contact ?? '';
    if (!emailAddr.includes('@')) {
      toast.error('유효한 이메일 주소가 없습니다. 거래처 담당자 정보를 확인해주세요.');
      return;
    }
    setIsSendingEmail(true);
    try {
      const completedAt = project.updatedAt
        ? new Date(project.updatedAt).toLocaleString('ko-KR')
        : '기록 없음';
      await sendReportEmail({
        to_email: emailAddr,
        project_name: project.name,
        worker_name: project.workerName,
        completed_at: completedAt,
      });
      toast.success(`${emailAddr}로 완료 보고 메일을 발송했습니다.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('메일 전송 실패: ' + msg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const photosByType = (type: PhotoType) => photos.filter(p => p.type === type);

  return (
    <>
      <div className="fixed inset-0 z-[40] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">

          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            capture="environment"
          />

          {/* 헤더 */}
          <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                {project.name}
                <span className={`text-xs px-3 py-1 rounded-full border ${
                  project.status === 'REJECTED' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  project.status === 'IN_PROGRESS' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  {project.status === 'REJECTED' ? '긴급 조치' : project.status === 'IN_PROGRESS' ? '진행중' : '완료됨'}
                </span>
              </h2>
              <p className="text-slate-400 mt-1 text-sm">
                담당 작업자: {project.workerName}
                {project.address && <> | {project.address}</>}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">

            {/* 왼쪽: 현장 사진 */}
            <div className="flex-1 space-y-6 min-w-0">
              <h3 className="text-lg font-semibold text-white border-l-4 border-blue-500 pl-3">현장 사진 증빙 자료</h3>

              {(['before', 'after', 'process'] as PhotoType[]).map(type => {
                const typePhotos = photosByType(type);
                const isUploading = uploadingType === type;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: `${PHOTO_TYPE_COLORS[type]}20`, color: PHOTO_TYPE_COLORS[type], border: `1px solid ${PHOTO_TYPE_COLORS[type]}40` }}>
                        {PHOTO_TYPE_LABELS[type]} ({typePhotos.length})
                      </span>
                      <button
                        onClick={() => handleUploadClick(type)}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        style={{ background: `${PHOTO_TYPE_COLORS[type]}15`, color: PHOTO_TYPE_COLORS[type], border: `1px solid ${PHOTO_TYPE_COLORS[type]}30` }}
                      >
                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {isUploading ? '업로드 중...' : '사진 추가'}
                      </button>
                    </div>

                    {typePhotos.length === 0 ? (
                      <button
                        onClick={() => handleUploadClick(type)}
                        className="w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:border-opacity-70"
                        style={{ borderColor: `${PHOTO_TYPE_COLORS[type]}40`, background: `${PHOTO_TYPE_COLORS[type]}08` }}
                      >
                        <Camera size={28} style={{ color: PHOTO_TYPE_COLORS[type], opacity: 0.5 }} />
                        <span className="text-sm font-medium" style={{ color: PHOTO_TYPE_COLORS[type], opacity: 0.6 }}>{PHOTO_TYPE_LABELS[type]} 사진 업로드</span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {typePhotos.map(photo => (
                          <div key={photo.storagePath} className={`relative aspect-video rounded-xl overflow-hidden group bg-slate-800 border-2 transition-colors ${photo.isForceCaptured ? 'border-red-500/50 hover:border-red-500' : 'border-transparent hover:border-blue-500'}`}>
                            <img src={photo.url} alt={PHOTO_TYPE_LABELS[photo.type as PhotoType]} className="w-full h-full object-cover" />
                            
                            {/* 플랜 B: AR 스팟 및 강제 촬영 표기 */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              {photo.arSpotName && (
                                <div className="px-2 py-1 bg-black/70 backdrop-blur-md rounded border border-cyan-500/50 flex items-center gap-1 shadow-lg">
                                  <MapPin size={10} className="text-cyan-400" />
                                  <span className="text-[10px] text-cyan-100 font-bold">{photo.arSpotName}</span>
                                </div>
                              )}
                              {photo.isForceCaptured && (
                                <div className="px-2 py-1 bg-red-500/90 backdrop-blur-md rounded border border-red-400 flex items-center gap-1 shadow-lg shadow-red-500/30 animate-pulse">
                                  <AlertCircle size={10} className="text-white" />
                                  <span className="text-[10px] text-white font-bold">AR 이탈 (수동승인)</span>
                                </div>
                              )}
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-white font-medium">
                                {new Date(photo.uploadedAt).toLocaleDateString('ko-KR')}
                              </span>
                              <button
                                onClick={() => handleDeletePhoto(photo.storagePath)}
                                disabled={deletingPath === photo.storagePath}
                                className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                              >
                                {deletingPath === photo.storagePath ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {photos.length === 0 && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <ImageIcon size={16} />
                    <span>위의 버튼을 눌러 작업 전/후/중 사진을 업로드하세요.</span>
                  </div>
                </div>
              )}

              {/* ── AR 현장 스팟 비교 뷰어 ── */}
              {project.arSpots && Object.keys(project.arSpots).length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-white border-l-4 border-cyan-500 pl-3 mb-4 mt-2">
                    AR 현장 스팟 ({Object.keys(project.arSpots).length}곳)
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(project.arSpots).map(([spotId, spot]: [string, ArSpotData]) => {
                      let duration: string | null = null;
                      if (spot.startedAt && spot.completedAt) {
                        const totalMins = Math.round((spot.completedAt - spot.startedAt) / 60000);
                        duration = totalMins >= 60
                          ? `${Math.floor(totalMins / 60)}시간 ${totalMins % 60}분`
                          : totalMins > 0 ? `${totalMins}분` : '1분 미만';
                      }
                      const photoSessions = [
                        { url: spot.beforeUrl, label: '작업 전', color: '#0ea5e9' },
                        { url: spot.duringUrl, label: '작업 중', color: '#f59e0b' },
                        { url: spot.afterUrl,  label: '작업 후', color: '#10b981' },
                      ];
                      return (
                        <div key={spotId} className="rounded-2xl border border-slate-700 overflow-hidden bg-slate-800/40">
                          {/* 스팟 헤더 */}
                          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-slate-700/50 bg-slate-800/60">
                            <MapPin size={13} className="text-cyan-400 shrink-0" />
                            <span className="font-bold text-white text-sm">{spot.name}</span>
                            {duration && (
                              <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                                <Clock size={11} /> {duration}
                              </span>
                            )}
                          </div>
                          {/* 사진 3분할 비교 */}
                          <div className="grid grid-cols-3 divide-x divide-slate-700/50">
                            {photoSessions.map(({ url, label, color }) => (
                              <div key={label} className="relative">
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                    <div className="aspect-square bg-slate-900 overflow-hidden">
                                      <img src={url} alt={label}
                                        className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                                    </div>
                                  </a>
                                ) : (
                                  <div className="aspect-square bg-slate-900 flex items-center justify-center">
                                    <Camera size={22} style={{ color, opacity: 0.18 }} />
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 px-2 py-1"
                                  style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.75),transparent)' }}>
                                  <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* 현장 메모 */}
                          {spot.note && (
                            <div className="px-4 py-2.5 border-t border-slate-700/50 flex items-start gap-2">
                              <StickyNote size={12} className="text-sky-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-300">{spot.note}</p>
                            </div>
                          )}
                          {/* 추가 작업 사진 */}
                          {spot.extraPhotos && spot.extraPhotos.length > 0 && (
                            <div className="px-4 py-3 border-t border-slate-700/50">
                              <div className="flex items-center gap-2 mb-2">
                                <ImageIcon size={12} className="text-slate-400" />
                                <span className="text-xs text-slate-400 font-semibold">
                                  추가 작업 사진 ({spot.extraPhotos.length}장)
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {spot.extraPhotos.filter((ep: ExtraPhotoData) => ep.url).map((ep: ExtraPhotoData) => (
                                  <a key={ep.id} href={ep.url} target="_blank" rel="noopener noreferrer"
                                    className="block aspect-square rounded-lg overflow-hidden bg-slate-900 hover:opacity-80 transition-opacity">
                                    <img src={ep.url} alt="추가 작업 사진"
                                      className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {project.status === 'REJECTED' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <h4 className="text-red-400 font-bold mb-1">반려 사유</h4>
                  <p className="text-red-200 text-sm">{project.rejectReason}</p>
                </div>
              )}
            </div>

            {/* 오른쪽: 원스톱 행정 처리 */}
            <div className="lg:w-80 space-y-6 shrink-0">
              <h3 className="text-lg font-semibold text-white border-l-4 border-emerald-500 pl-3">원스톱 행정 처리</h3>

              <div className="space-y-3">
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <FileText size={20} />
                    </div>
                    <span className="font-medium text-slate-200">PDF 완료 보고서 생성</span>
                  </div>
                </button>

                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <Calculator size={20} />
                    </div>
                    <span className="font-medium text-slate-200">견적서 및 세금계산서 발행</span>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = `/fax?docName=${encodeURIComponent(project.name + ' 정산서')}`}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <Printer size={20} />
                    </div>
                    <span className="font-medium text-slate-200">관공서 팩스 일괄 전송</span>
                  </div>
                </button>

                <button
                  onClick={handleSendReportEmail}
                  disabled={isSendingEmail}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      {isSendingEmail ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
                    </div>
                    <span className="font-medium text-slate-200">
                      {isSendingEmail ? '이메일 발송 중...' : '담당자 메일 전송'}
                    </span>
                  </div>
                </button>
              </div>

              {/* 현장 정보 요약 */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
                <h4 className="text-sm font-bold text-slate-300 mb-3">현장 정보</h4>
                {[
                  { label: '현장명', value: project.name },
                  { label: '작업자', value: project.workerName },
                  { label: '주소', value: project.address ?? '-' },
                  { label: '거래처', value: project.clientName ?? '-' },
                  { label: '담당자', value: project.manager ?? '-' },
                  { label: '사진 수', value: `${photos.length}장` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-2 text-sm">
                    <span className="text-slate-500 w-16 shrink-0">{label}</span>
                    <span className="text-slate-200 truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showInvoiceModal && (
        <InvoiceIssueModal
          isOpen={true}
          selectedProjects={[{ id: project.id, name: project.name, price: project.price || 0 }]}
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={() => {
            setShowInvoiceModal(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
