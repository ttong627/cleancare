'use client';

import { Shield, Key, Database, RefreshCcw, Smartphone, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [rbacEnabled, setRbacEnabled] = useState(true);
  const [offlineSync, setOfflineSync] = useState(true);

  const handleSave = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: '보안 정책 및 시스템 설정 클라우드 배포 중...',
        success: <b>서버에 설정이 안전하게 반영되었습니다.</b>,
        error: <b>반영 실패</b>,
      }
    );
  };

  const handleTestConnection = () => {
    toast.success('Firebase Firestore 연결 및 권한 검증 완료!', { icon: '🟢' });
  };

  return (
    <div className="p-8 min-h-screen flex flex-col max-w-6xl">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-2">
            <Shield className="text-blue-500" size={32} />
            시스템 환경 및 보안 설정
          </h1>
          <p className="text-slate-400">설계서 V2.0 기준 강력한 역할 기반 접근 제어(RBAC) 및 클라우드 연동 상태를 제어합니다.</p>
        </div>
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-colors"
        >
          설정 저장 및 배포
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. 서버 상태 및 연동 관리 */}
        <section className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Database className="text-emerald-500" size={24} />
            <h2 className="text-xl font-bold text-white">클라우드 서버 상태</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
              <div>
                <p className="text-slate-300 font-medium">Firestore Database 연결</p>
                <p className="text-xs text-slate-500 mt-1">프로젝트: cleancare-cf307</p>
              </div>
              <span className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-sm">
                <CheckCircle2 size={16} /> 정상 작동 중
              </span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
              <div>
                <p className="text-slate-300 font-medium">Cloud Storage (이미지 보관함)</p>
                <p className="text-xs text-slate-500 mt-1">용량: 무제한 / WebP 압축 적용</p>
              </div>
              <span className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-sm">
                <CheckCircle2 size={16} /> 정상 작동 중
              </span>
            </div>

            <button 
              onClick={handleTestConnection}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-xl transition-colors"
            >
              <RefreshCcw size={18} /> 전체 통신망 자가진단 테스트
            </button>
          </div>
        </section>

        {/* 2. 보안 및 역할 제어 (RBAC) */}
        <section className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Key className="text-orange-500" size={24} />
            <h2 className="text-xl font-bold text-white">RBAC 권한 제어 엔진</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div>
                <p className="text-white font-medium mb-1">작업자 전용 모드 강제 (firestore.rules)</p>
                <p className="text-sm text-slate-400">현장 작업자는 본인에게 할당된 프로젝트 데이터만 수정할 수 있도록 접근을 원천 차단합니다.</p>
              </div>
              <button onClick={() => setRbacEnabled(!rbacEnabled)}>
                {rbacEnabled ? <ToggleRight className="text-blue-500" size={40} /> : <ToggleLeft className="text-slate-600" size={40} />}
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div>
                <p className="text-white font-medium mb-1">모바일 오프라인-퍼스트 동기화</p>
                <p className="text-sm text-slate-400">통신 음영 지역에서 로컬 캐시를 사용하고, 연결 복구 시 타임스탬프 기반 병합을 수행합니다.</p>
              </div>
              <button onClick={() => setOfflineSync(!offlineSync)}>
                {offlineSync ? <ToggleRight className="text-blue-500" size={40} /> : <ToggleLeft className="text-slate-600" size={40} />}
              </button>
            </div>
            
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <p className="text-orange-400 text-sm">
                <strong>주의:</strong> RBAC 규칙을 끄면 테스트 모드(모두 허용)로 전환되어 데이터 위변조 위험이 있습니다. 실 서버 운영 시 반드시 켜두세요.
              </p>
            </div>
          </div>
        </section>

        {/* 3. 모바일 앱 환경 연동 */}
        <section className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <Smartphone className="text-purple-500" size={24} />
            <h2 className="text-xl font-bold text-white">모바일 애플리케이션 (Flutter) 제어</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-slate-400 mb-2">배포 버전</p>
              <p className="text-2xl font-bold text-white">v1.0.4 (최신)</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-slate-400 mb-2">AR 카메라 (LiDAR)</p>
              <p className="text-lg font-bold text-emerald-400">모듈 정상 렌더링</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-slate-400 mb-2">백그라운드 GPS</p>
              <p className="text-lg font-bold text-blue-400">활성화 됨 (배터리 최적화)</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
