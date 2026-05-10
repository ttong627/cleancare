'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProjectData, ArSpotData, ExtraPhotoData } from '@/hooks/useProjects';
import {
  BookImage, Search, Printer, Download, FileSpreadsheet,
  Loader2, Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmtDate(ts?: number) {
  if (!ts) return '–';
  return new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDuration(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt || !completedAt) return null;
  const totalMins = Math.round((completedAt - startedAt) / 60000);
  if (totalMins >= 60) return `${Math.floor(totalMins / 60)}시간 ${totalMins % 60}분`;
  if (totalMins > 0) return `${totalMins}분`;
  return '1분 미만';
}

interface SpotRow {
  id: string;
  spot: ArSpotData;
  duration: string | null;
}

interface FlatExtra extends ExtraPhotoData {
  spotName: string;
}

// ─────────────────────────────────────────────────────────────
// Info row helper
// ─────────────────────────────────────────────────────────────
function InfoRow({ label, value, highlight, fullWidth }: {
  label: string; value: string; highlight?: boolean; fullWidth?: boolean;
}) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: highlight ? 17 : 14, fontWeight: highlight ? 800 : 600, color: highlight ? '#0369a1' : '#0f172a' }}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Photo cell
// ─────────────────────────────────────────────────────────────
function PhotoCell({ url, label, color }: { url?: string; label: string; color: string }) {
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <div style={{ padding: '4px 10px', background: color + '18', borderBottom: `2px solid ${color}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      </div>
      <div style={{
        aspectRatio: '4/3', background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {url
          ? <img src={url} alt={label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          : <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
              <div style={{ fontSize: 26 }}>📷</div>
              <p style={{ fontSize: 10 }}>미촬영</p>
            </div>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page header shared across cover + spot pages
// ─────────────────────────────────────────────────────────────
function DocHeader({ projectName }: { projectName: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #e2e8f0',
    }}>
      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em' }}>
        작업사진대장 · {projectName}
      </span>
      <span style={{ fontSize: 10, color: '#94a3b8' }}>
        CLEANCARE SYSTEM
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Excel image fetch helper
// ─────────────────────────────────────────────────────────────
async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Excel style helpers
// ─────────────────────────────────────────────────────────────
function makeHeaderStyle() {
  return {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } as { argb: string } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF005BB7' } as { argb: string } },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FF0044AA' } as { argb: string } },
      left: { style: 'thin' as const, color: { argb: 'FF0044AA' } as { argb: string } },
      bottom: { style: 'thin' as const, color: { argb: 'FF0044AA' } as { argb: string } },
      right: { style: 'thin' as const, color: { argb: 'FF0044AA' } as { argb: string } },
    },
  };
}

function makeDataStyle(rowIndex: number) {
  const bg = rowIndex % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
  return {
    font: { size: 10, color: { argb: 'FF0F172A' } as { argb: string } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: bg } as { argb: string } },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } as { argb: string } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } as { argb: string } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } as { argb: string } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } as { argb: string } },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export default function PhotoLedgerPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [generating, setGenerating] = useState<'pdf' | 'excel' | null>(null);
  const [excelProgress, setExcelProgress] = useState('');
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectData));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProjects(data);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.workerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const photoMode = selectedProject?.photoMode || 'bda';
  const isTwoStage = photoMode === 'ba';

  const spots: SpotRow[] = selectedProject?.arSpots
    ? Object.entries(selectedProject.arSpots)
        .map(([id, spot]) => ({ id, spot, duration: fmtDuration(spot.startedAt, spot.completedAt) }))
        .sort((a, b) => (a.spot.startedAt || 0) - (b.spot.startedAt || 0))
    : [];

  const extraPhotosAll: FlatExtra[] = spots.flatMap(({ spot }) =>
    (spot.extraPhotos ?? [])
      .filter((ep): ep is ExtraPhotoData & { url: string } => !!ep.url)
      .map(ep => ({ ...ep, spotName: spot.name }))
  );

  // ── Print
  const handlePrint = () => window.print();

  // 외부 이미지를 blob URL로 변환 (CORS 우회 — html2canvas용)
  const convertImagesToBlob = async (container: HTMLElement): Promise<() => void> => {
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img[src]'));
    const origSrcs: string[] = [];
    const blobUrls: string[] = [];

    await Promise.all(imgs.map(async (img, i) => {
      origSrcs[i] = img.src;
      try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrls[i] = blobUrl;
        img.src = blobUrl;
        await new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });
      } catch { /* 원본 유지 */ }
    }));

    return () => {
      imgs.forEach((img, i) => {
        if (origSrcs[i]) img.src = origSrcs[i];
        if (blobUrls[i]) URL.revokeObjectURL(blobUrls[i]);
      });
    };
  };

  // ── PDF via jsPDF page-by-page
  const handleSavePDF = async () => {
    if (!docRef.current || !selectedProject) return;
    setGenerating('pdf');
    const toastId = toast.loading('PDF 생성 중... (사진 변환 중)');
    let restoreImages: (() => void) | null = null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { default: jsPDF } = await import('jspdf');

      restoreImages = await convertImagesToBlob(docRef.current);
      toast.loading('PDF 페이지 렌더링 중...', { id: toastId });

      const pages = docRef.current.querySelectorAll<HTMLElement>('.ledger-page');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const A4W = 210;
      const A4H = 297;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2, useCORS: false, allowTaint: false,
          backgroundColor: '#ffffff', logging: false,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgW = A4W;
        const imgH = (canvas.height * A4W) / canvas.width;

        if (i > 0) pdf.addPage();

        if (imgH <= A4H) {
          pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
        } else {
          let oy = 0;
          const sliceH = (A4H * canvas.width) / A4W;
          while (oy < canvas.height) {
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.min(sliceH, canvas.height - oy);
            const ctx = sliceCanvas.getContext('2d')!;
            ctx.drawImage(canvas, 0, -oy);
            const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.92);
            const sliceImgH = (sliceCanvas.height * A4W) / canvas.width;
            if (oy > 0) pdf.addPage();
            pdf.addImage(sliceImg, 'JPEG', 0, 0, imgW, sliceImgH);
            oy += sliceH;
          }
        }
      }

      pdf.save(`작업사진대장_${selectedProject.name}.pdf`);
      toast.success('PDF 저장 완료', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('PDF 생성 실패', { id: toastId });
    } finally {
      restoreImages?.();
      setGenerating(null);
    }
  };

  // ── Excel with embedded images (ExcelJS)
  const handleExcel = async () => {
    if (!selectedProject) return;
    setGenerating('excel');
    const toastId = toast.loading('엑셀 생성 중...');
    try {
      const ExcelJS = (await import('exceljs')).default;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = '크린케어시스템';
      workbook.created = new Date();

      const mode = (selectedProject.photoMode ?? 'bda');
      const is2 = mode === 'ba';
      const IMG_H = 130;   // row height in points (~173px)
      const IMG_W = 28;    // column width in chars

      // ── Sheet 1: 표지 ────────────────────────────────────────
      const coverWs = workbook.addWorksheet('표지');
      coverWs.columns = [{ width: 20 }, { width: 50 }, { width: 20 }];

      const titleRow = coverWs.addRow(['작업사진대장', '', '크린케어시스템']);
      titleRow.font = { bold: true, size: 16, color: { argb: 'FF005BB7' } };
      titleRow.height = 32;
      coverWs.mergeCells('A1:B1');

      coverWs.addRow([]);
      const infoData = [
        ['현장명', selectedProject.name],
        ['작업자', selectedProject.workerName || ''],
        ['의뢰인', selectedProject.clientName || ''],
        ['담당자', selectedProject.manager || ''],
        ['연락처', selectedProject.contact || ''],
        ['주소', selectedProject.address || ''],
        ['작업 상태', selectedProject.status === 'COMPLETED' ? '작업완료'
          : selectedProject.status === 'IN_PROGRESS' ? '진행중' : selectedProject.status],
        ['등록일', fmtDate(selectedProject.createdAt)],
        ['완료일', fmtDate(selectedProject.updatedAt)],
        ['총 스팟 수', `${spots.length}곳`],
        ['사진 구성', is2 ? '전·후 2단계' : '전·중·후 3단계'],
        ['총 추가사진', `${extraPhotosAll.length}장`],
        ['메모', selectedProject.memo || ''],
        ['출력일', new Date().toLocaleDateString('ko-KR')],
      ];
      for (const [label, val] of infoData) {
        const r = coverWs.addRow([label, val]);
        r.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
        r.getCell(2).font = { size: 10 };
        r.height = 18;
      }

      // ── Sheet 2: 작업사진대장 ──────────────────────────────────
      const photoWs = workbook.addWorksheet('작업사진대장');

      if (is2) {
        photoWs.columns = [
          { width: 18 },   // A: 스팟명
          { width: IMG_W },// B: 작업 전
          { width: IMG_W },// C: 작업 후
          { width: 13 },   // D: 소요시간
          { width: 35 },   // E: 메모
        ];
        const hdr = photoWs.addRow(['스팟명', '작업 전', '작업 후', '소요시간', '메모']);
        hdr.height = 22;
        hdr.eachCell(c => Object.assign(c, makeHeaderStyle()));
      } else {
        photoWs.columns = [
          { width: 18 },   // A: 스팟명
          { width: IMG_W },// B: 작업 전
          { width: IMG_W },// C: 작업 중
          { width: IMG_W },// D: 작업 후
          { width: 13 },   // E: 소요시간
          { width: 35 },   // F: 메모
        ];
        const hdr = photoWs.addRow(['스팟명', '작업 전', '작업 중', '작업 후', '소요시간', '메모']);
        hdr.height = 22;
        hdr.eachCell(c => Object.assign(c, makeHeaderStyle()));
      }

      // Collect all image URLs to fetch (progress tracking)
      const allImgUrls: string[] = [];
      for (const { spot } of spots) {
        if (spot.beforeUrl) allImgUrls.push(spot.beforeUrl);
        if (!is2 && spot.duringUrl) allImgUrls.push(spot.duringUrl);
        if (spot.afterUrl) allImgUrls.push(spot.afterUrl);
        for (const ep of spot.extraPhotos ?? []) {
          if (ep.url) allImgUrls.push(ep.url);
        }
      }

      let fetched = 0;
      const imgCache = new Map<string, ArrayBuffer | null>();
      for (const url of allImgUrls) {
        if (!imgCache.has(url)) {
          fetched++;
          setExcelProgress(`사진 불러오는 중... ${fetched}/${allImgUrls.length}`);
          toast.loading(`사진 불러오는 중... ${fetched}/${allImgUrls.length}`, { id: toastId });
          imgCache.set(url, await fetchImageBuffer(url));
        }
      }

      toast.loading('엑셀 시트 작성 중...', { id: toastId });

      const addImgToSheet = (ws: typeof photoWs, url: string | undefined, col: number, rowIdx: number) => {
        if (!url) return;
        const buf = imgCache.get(url);
        if (!buf) return;
        const ext = url.toLowerCase().includes('.png') ? 'png' : 'jpeg';
        const imageId = workbook.addImage({ buffer: buf, extension: ext });
        ws.addImage(imageId, {
          tl: { col, row: rowIdx - 1 },     // 0-based row
          br: { col: col + 1, row: rowIdx }, // 0-based row
          editAs: 'oneCell',
        } as Parameters<typeof ws.addImage>[1]);
      };

      for (let i = 0; i < spots.length; i++) {
        const { spot, duration } = spots[i];
        const rowIdx = i + 2; // 1-based (row 1 = header)
        const ds = makeDataStyle(i);

        let row;
        if (is2) {
          row = photoWs.addRow([spot.name, '', '', duration || '', spot.note || '']);
        } else {
          row = photoWs.addRow([spot.name, '', '', '', duration || '', spot.note || '']);
        }
        row.height = IMG_H;
        row.getCell(1).style = { ...ds, alignment: { vertical: 'top', horizontal: 'left', wrapText: true } };
        row.eachCell((c, idx) => {
          if (idx > 1) c.style = ds;
        });

        if (is2) {
          addImgToSheet(photoWs, spot.beforeUrl, 1, rowIdx);
          addImgToSheet(photoWs, spot.afterUrl,  2, rowIdx);
        } else {
          addImgToSheet(photoWs, spot.beforeUrl,  1, rowIdx);
          addImgToSheet(photoWs, spot.duringUrl,  2, rowIdx);
          addImgToSheet(photoWs, spot.afterUrl,   3, rowIdx);
        }
      }

      // Freeze top header row
      photoWs.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

      // ── Sheet 3: 추가작업사진 ─────────────────────────────────
      if (extraPhotosAll.length > 0) {
        const extraWs = workbook.addWorksheet('추가작업사진');
        extraWs.columns = [
          { width: 18 },   // A: 스팟명
          { width: IMG_W },// B: 사진
          { width: 22 },   // C: 촬영시각
        ];
        const hdr = extraWs.addRow(['스팟명', '추가 사진', '촬영시각']);
        hdr.height = 22;
        hdr.eachCell(c => Object.assign(c, makeHeaderStyle()));

        for (let i = 0; i < extraPhotosAll.length; i++) {
          const ep = extraPhotosAll[i];
          const rowIdx = i + 2;
          const ds = makeDataStyle(i);
          const row = extraWs.addRow([
            ep.spotName, '',
            ep.capturedAt ? new Date(ep.capturedAt).toLocaleString('ko-KR') : '',
          ]);
          row.height = IMG_H;
          row.getCell(1).style = { ...ds, alignment: { vertical: 'top', horizontal: 'left', wrapText: true } };
          row.eachCell((c, idx) => { if (idx > 1) c.style = ds; });

          addImgToSheet(extraWs, ep.url, 1, rowIdx);
        }

        extraWs.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ── Generate & download ───────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `작업사진대장_${selectedProject.name}.xlsx`;
      a.click();
      URL.revokeObjectURL(dlUrl);

      toast.success('엑셀 저장 완료', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('엑셀 생성 실패', { id: toastId });
    } finally {
      setGenerating(null);
      setExcelProgress('');
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ledger-doc, #ledger-doc * { visibility: visible !important; }
          #ledger-doc { position: absolute !important; top: 0; left: 0; width: 100%; }
          .ledger-page { page-break-after: always; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
          .ledger-page:last-child { page-break-after: avoid; }
          .no-print { display: none !important; }
          @page { margin: 12mm; size: A4 portrait; }
        }
      `}</style>

      <div className="p-8 min-h-screen flex flex-col">
        {/* Header */}
        <header className="mb-8 no-print">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 mb-2" style={{ color: '#0f172a' }}>
            <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 16px rgba(14,165,233,0.4)' }}>
              <BookImage className="text-white" size={24} />
            </div>
            작업사진대장
          </h1>
          <p className="ml-14 font-medium" style={{ color: '#64748b' }}>
            현장별 전·중·후 사진과 추가 작업사진을 문서화하여 출력·PDF·엑셀로 저장합니다.
          </p>
        </header>

        <div className="flex gap-6 flex-1" style={{ minHeight: 0 }}>
          {/* Left: project list */}
          <div className="no-print w-72 shrink-0 flex flex-col rounded-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(14,165,233,0.15)', boxShadow: '0 8px 32px rgba(14,165,233,0.1)' }}>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="현장명, 작업자 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  style={{ background: 'rgba(241,245,249,0.9)', border: '1px solid rgba(14,165,233,0.15)', color: '#0f172a' }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="animate-spin text-sky-500" size={32} />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-slate-400 mt-10 text-sm">현장이 없습니다.</p>
              ) : (
                filtered.map(project => {
                  const isActive = selectedProject?.id === project.id;
                  const spotCount = Object.keys(project.arSpots || {}).length;
                  const pm = project.photoMode ?? 'bda';
                  let cnt = 0;
                  Object.values(project.arSpots || {}).forEach(s => {
                    if (s.beforeUrl) cnt++;
                    if (s.duringUrl) cnt++;
                    if (s.afterUrl) cnt++;
                    cnt += (s.extraPhotos || []).filter(ep => ep.url).length;
                  });
                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="w-full text-left p-3 rounded-2xl transition-all"
                      style={isActive ? {
                        background: 'linear-gradient(135deg,rgba(14,165,233,0.15),rgba(99,102,241,0.12))',
                        border: '1px solid rgba(14,165,233,0.35)',
                        boxShadow: '0 4px 12px rgba(14,165,233,0.15)',
                      } : {
                        background: 'rgba(248,250,252,0.8)',
                        border: '1px solid rgba(226,232,240,0.8)',
                      }}
                    >
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-bold text-sm truncate" style={{ color: isActive ? '#0369a1' : '#0f172a' }}>
                          {project.name}
                        </span>
                        {spotCount > 0 && (
                          <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: 'rgba(14,165,233,0.1)', color: '#0369a1' }}>
                            {spotCount}스팟
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{fmtDate(project.createdAt)}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: pm === 'ba' ? 'rgba(99,102,241,0.1)' : 'rgba(14,165,233,0.1)',
                            color: pm === 'ba' ? '#6366f1' : '#0369a1' }}>
                          {pm === 'ba' ? '전·후' : '전·중·후'}
                        </span>
                        {cnt > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                            📷 {cnt}장
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: document preview */}
          <div className="flex-1 flex flex-col rounded-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(14,165,233,0.15)', boxShadow: '0 8px 32px rgba(14,165,233,0.1)' }}>
            {selectedProject ? (
              <>
                {/* Toolbar */}
                <div className="no-print p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-bold text-base" style={{ color: '#0f172a' }}>{selectedProject.name}</h2>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      {isTwoStage ? '전·후 2단계' : '전·중·후 3단계'} · 스팟 {spots.length}개 · 추가사진 {extraPhotosAll.length}장
                    </p>
                    {excelProgress && (
                      <p className="text-xs mt-0.5" style={{ color: '#0ea5e9' }}>{excelProgress}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleExcel}
                      disabled={generating !== null}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
                      style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                    >
                      {generating === 'excel'
                        ? <Loader2 size={16} className="animate-spin" />
                        : <FileSpreadsheet size={16} />}
                      엑셀 저장
                    </button>
                    <button
                      onClick={handleSavePDF}
                      disabled={generating !== null}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
                      style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
                    >
                      {generating === 'pdf'
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Download size={16} />}
                      PDF 저장
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}
                    >
                      <Printer size={16} /> 인쇄
                    </button>
                  </div>
                </div>

                {/* Document scroll area */}
                <div className="flex-1 overflow-y-auto p-6" style={{ background: '#e2e8f0' }}>
                  <div ref={docRef} id="ledger-doc" style={{ maxWidth: 794, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* ── Cover page */}
                    <div className="ledger-page bg-white" style={{ padding: '40px 48px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                      <DocHeader projectName={selectedProject.name} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, marginTop: 16 }}>
                        <div style={{ width: 6, height: 56, background: 'linear-gradient(180deg,#0ea5e9,#6366f1)', borderRadius: 3, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.12em', marginBottom: 4 }}>
                            CLEANCARE SYSTEM
                          </p>
                          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                            작업사진대장
                          </h1>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px', marginBottom: 24 }}>
                        <InfoRow label="현장명" value={selectedProject.name} highlight fullWidth />
                        <InfoRow label="작업자" value={selectedProject.workerName || '–'} />
                        <InfoRow label="의뢰인" value={selectedProject.clientName || '–'} />
                        <InfoRow label="담당자" value={selectedProject.manager || '–'} />
                        <InfoRow label="연락처" value={selectedProject.contact || '–'} />
                        <InfoRow label="주소" value={selectedProject.address || '–'} fullWidth />
                        <InfoRow label="작업일" value={fmtDate(selectedProject.createdAt)} />
                        <InfoRow label="완료일" value={fmtDate(selectedProject.updatedAt)} />
                        <InfoRow label="사진 구성" value={isTwoStage ? '전·후 2단계' : '전·중·후 3단계'} />
                        <InfoRow label="상태"
                          value={selectedProject.status === 'COMPLETED' ? '✅ 작업완료'
                            : selectedProject.status === 'IN_PROGRESS' ? '🔧 진행중' : selectedProject.status} />
                      </div>

                      {selectedProject.memo && (
                        <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, borderLeft: '4px solid #0ea5e9', marginBottom: 20 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>작업 내용</p>
                          <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.65 }}>{selectedProject.memo}</p>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        {[
                          { label: '총 스팟', value: `${spots.length}곳`, color: '#0ea5e9' },
                          { label: '추가 사진', value: `${extraPhotosAll.length}장`, color: '#10b981' },
                          { label: '출력일', value: new Date().toLocaleDateString('ko-KR'), color: '#6366f1' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ padding: '10px 14px', background: color + '10', borderRadius: 8, border: `1px solid ${color}28`, textAlign: 'center' }}>
                            <p style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</p>
                            <p style={{ fontSize: 15, fontWeight: 800, color }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Per-spot pages */}
                    {spots.map(({ id, spot, duration }, idx) => (
                      <div key={id} className="ledger-page bg-white"
                        style={{ padding: '32px 40px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                        <DocHeader projectName={selectedProject.name} />

                        {/* Spot header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, marginTop: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 4, height: 32, background: 'linear-gradient(180deg,#0ea5e9,#6366f1)', borderRadius: 2 }} />
                            <div>
                              <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>작업 현장 사진 비교</p>
                              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{spot.name}</h2>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {duration && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}>
                                <span style={{ fontSize: 11, color: '#f59e0b' }}>⏱</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{duration}</span>
                              </div>
                            )}
                            <p style={{ fontSize: 9, color: '#94a3b8' }}>스팟 {idx + 1} / {spots.length}</p>
                          </div>
                        </div>

                        {/* Photo stats */}
                        {(() => {
                          const photoCount = [spot.beforeUrl, spot.duringUrl, spot.afterUrl].filter(Boolean).length;
                          const extraCount = (spot.extraPhotos || []).filter(ep => ep.url).length;
                          return (photoCount > 0 || extraCount > 0) ? (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                              {photoCount > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(14,165,233,0.1)', color: '#0369a1' }}>
                                  📷 {isTwoStage ? '전·후' : '전·중·후'} {photoCount}장
                                </span>
                              )}
                              {extraCount > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                                  ➕ 추가 {extraCount}장
                                </span>
                              )}
                            </div>
                          ) : null;
                        })()}

                        {/* Photo grid — 2 or 3 columns based on photoMode */}
                        {isTwoStage ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <PhotoCell url={spot.beforeUrl} label="작업 전" color="#0ea5e9" />
                            <PhotoCell url={spot.afterUrl}  label="작업 후" color="#10b981" />
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <PhotoCell url={spot.beforeUrl} label="작업 전" color="#0ea5e9" />
                            <PhotoCell url={spot.duringUrl} label="작업 중" color="#f59e0b" />
                            <PhotoCell url={spot.afterUrl}  label="작업 후" color="#10b981" />
                          </div>
                        )}

                        {/* Times */}
                        {(spot.startedAt || spot.completedAt) && (
                          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                            {spot.startedAt && (
                              <p style={{ fontSize: 10, color: '#94a3b8' }}>
                                시작: {new Date(spot.startedAt).toLocaleString('ko-KR')}
                              </p>
                            )}
                            {spot.completedAt && (
                              <p style={{ fontSize: 10, color: '#94a3b8' }}>
                                완료: {new Date(spot.completedAt).toLocaleString('ko-KR')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Note */}
                        {spot.note && (
                          <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>📝 현장 메모: </span>
                            <span style={{ fontSize: 12, color: '#334155' }}>{spot.note}</span>
                          </div>
                        )}

                        {/* Extra photos for this spot */}
                        {(() => {
                          const extras = (spot.extraPhotos ?? []).filter(ep => ep.url);
                          if (extras.length === 0) return null;
                          return (
                            <div style={{ marginTop: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                <div style={{ width: 3, height: 20, background: 'linear-gradient(180deg,#10b981,#059669)', borderRadius: 2 }} />
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>추가 작업사진 ({extras.length}장)</p>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {extras.map((ep, ei) => (
                                  <div key={ep.id || ei} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #bbf7d0' }}>
                                    <div style={{ aspectRatio: '1', background: '#f1f5f9', overflow: 'hidden' }}>
                                      <img src={ep.url} alt={`추가 ${ei + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    </div>
                                    {ep.capturedAt && (
                                      <div style={{ padding: '2px 5px', background: '#f0fdf4' }}>
                                        <p style={{ fontSize: 8, color: '#059669' }}>
                                          {new Date(ep.capturedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}

                    {/* ── Extra photos summary page (all extras together) */}
                    {extraPhotosAll.length > 0 && (
                      <div className="ledger-page bg-white"
                        style={{ padding: '32px 40px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                        <DocHeader projectName={selectedProject.name} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, marginTop: 10 }}>
                          <div style={{ width: 4, height: 32, background: 'linear-gradient(180deg,#10b981,#059669)', borderRadius: 2 }} />
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>추가 작업 사진 전체</p>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                              작업 중 추가 촬영 ({extraPhotosAll.length}장)
                            </h2>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                          {extraPhotosAll.map((ep, i) => (
                            <div key={ep.id || i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                              <div style={{ padding: '3px 8px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
                                <p style={{ fontSize: 9, fontWeight: 700, color: '#059669', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ep.spotName}
                                </p>
                              </div>
                              <div style={{ aspectRatio: '1', background: '#f1f5f9', overflow: 'hidden' }}>
                                <img src={ep.url!} alt={`추가사진 ${i + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                              {ep.capturedAt && (
                                <div style={{ padding: '2px 6px', background: '#f8fafc' }}>
                                  <p style={{ fontSize: 8, color: '#94a3b8' }}>
                                    {new Date(ep.capturedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ color: '#94a3b8' }}>
                <BookImage size={72} className="mb-4 opacity-20" />
                <p className="font-semibold text-base">왼쪽에서 현장을 선택하면</p>
                <p className="text-sm">작업사진대장을 미리볼 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
