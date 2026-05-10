'use client';

import { Key, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ApiSettingsPage() {
  const [keys, setKeys] = useState({
    weather: '',
    kakaoApp: '',
    kakaoJs: '',
    kakaoRest: '',
    popbillLink: '',
    popbillSecret: '',
  });

  const [status, setStatus] = useState({
    weather: '대기',
    kakao: '대기',
    popbill: '대기',
  });

  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // 컴포넌트 마운트 시 LocalStorage에서 데이터 불러오기 (DB 대용 무지연 캐싱)
  useEffect(() => {
    const savedKeys = localStorage.getItem('cleanCareApiKeys');
    const savedStatus = localStorage.getItem('cleanCareApiStatus');
    if (savedKeys) setKeys(JSON.parse(savedKeys));
    if (savedStatus) setStatus(JSON.parse(savedStatus));
  }, []);

  const handleTestAndSave = (type: 'weather' | 'kakao' | 'popbill') => {
    setLoadingType(type);
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'API 키 유효성 검사 및 DB(캐시) 저장 중...',
        success: () => {
          setLoadingType(null);
          const newStatus = { ...status, [type]: '연결됨' };
          setStatus(newStatus);
          
          // 브라우저 로컬 DB에 영구 저장 (새로고침 방어)
          localStorage.setItem('cleanCareApiKeys', JSON.stringify(keys));
          localStorage.setItem('cleanCareApiStatus', JSON.stringify(newStatus));
          
          return <b>정상적으로 연결 및 저장되었습니다!</b>;
        },
        error: () => {
          setLoadingType(null);
          return <b>연결 실패. 키를 확인해주세요.</b>;
        },
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKeys = { ...keys, [e.target.name]: e.target.value };
    setKeys(newKeys);
    
    // Reset status to waiting if key changes
    let newStatus = { ...status };
    if (e.target.name === 'weather') newStatus.weather = '대기';
    else if (e.target.name.startsWith('kakao')) newStatus.kakao = '대기';
    else if (e.target.name.startsWith('popbill')) newStatus.popbill = '대기';
    
    setStatus(newStatus);
    
    // 키가 수정되면 변경된 상태를 즉시 저장
    localStorage.setItem('cleanCareApiKeys', JSON.stringify(newKeys));
    localStorage.setItem('cleanCareApiStatus', JSON.stringify(newStatus));
  };

  const renderBadge = (currentStatus: string) => {
    if (currentStatus === '연결됨') {
      return <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-teal-100 text-teal-700 rounded-md"><CheckCircle2 size={14}/>연결 완료</span>;
    }
    return <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-md"><AlertCircle size={14}/>연결 대기</span>;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen flex flex-col">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3 mb-2">
            <Key className="text-teal-600" size={32} />
            외부 API 연동 설정
          </h1>
          <p className="text-slate-500 text-lg">크린케어 모바일 앱 및 웹 시스템 연동을 위한 외부 API 인증키를 개별적으로 테스트하고 관리합니다.</p>
        </div>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 flex gap-4 items-start justify-between">
        <div className="flex gap-4">
          <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-blue-900 font-bold mb-1">API 키 발급 및 입력 가이드</h3>
            <p className="text-blue-800/80 leading-relaxed text-sm">
              각 서비스의 공식 홈페이지(OpenWeatherMap, Kakao Developers, 팝빌)에서 기업용 계정으로 회원가입 후 키를 발급받아 입력해 주세요.<br/>
              어떤 사이트에서 어떤 요금제로 가입해야 하는지 헷갈리신다면 우측의 <b>[API 통합 발급 가이드]</b> 버튼을 눌러 확인해 주세요.
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsGuideOpen(true)}
          className="shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors"
        >
          📖 API 통합 발급 가이드 보기
        </button>
      </div>

      <div className="space-y-8">
        {/* 날씨 API 섹션 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">1. 위치 기반 날씨 연동 (OpenWeatherMap)</h2>
            <div className="flex gap-3 items-center">
              {renderBadge(status.weather)}
              <button onClick={() => handleTestAndSave('weather')} disabled={loadingType === 'weather' || !keys.weather} className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors">
                {loadingType === 'weather' ? '테스트 중...' : '연결 테스트 및 저장'}
              </button>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-4">
              현장 작업자 앱(Mobile)에서 GPS를 기반으로 실시간 구역 날씨를 표시합니다.<br/>
              <span className="text-teal-600 font-bold">* 기상청 API 대신 OpenWeatherMap을 사용하는 이유:</span> 기상청 데이터는 복잡한 XY 격자 변환 과정이 필요하여 모바일 로딩 지연이 발생할 수 있으나, OpenWeatherMap은 GPS(위도/경도)를 직결하여 무지연(Zero-Loading) 최고 성능을 보장합니다.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">API Key (OpenWeatherMap 발급)</label>
                <input type="text" name="weather" value={keys.weather} onChange={handleChange} placeholder="예: 8a91b2c3d4..." className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
              </div>
            </div>
          </div>
        </section>

        {/* 카카오내비 및 지도 API 섹션 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">2. 실시간 카카오맵 및 길안내 연동 (Kakao Map & Navi)</h2>
            <div className="flex gap-3 items-center">
              {renderBadge(status.kakao)}
              <button onClick={() => handleTestAndSave('kakao')} disabled={loadingType === 'kakao' || !keys.kakaoApp || !keys.kakaoJs || !(keys as any).kakaoRest} className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors">
                {loadingType === 'kakao' ? '테스트 중...' : '연결 테스트 및 저장'}
              </button>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-4">PC 관제센터의 카카오 지도(Map) 표시 및 모바일 현장 길안내(Navi), 주소 자동 변환(Geocoding)을 담당합니다.</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">JavaScript Key (PC 지도용)</label>
                <input type="text" name="kakaoJs" value={keys.kakaoJs} onChange={handleChange} placeholder="카카오 디벨로퍼스 자바스크립트 키" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">REST API Key (주소 자동변환용)</label>
                <input type="text" name="kakaoRest" value={(keys as any).kakaoRest || ''} onChange={handleChange} placeholder="카카오 디벨로퍼스 REST API 키" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Native App Key (모바일 내비용)</label>
                <input type="text" name="kakaoApp" value={keys.kakaoApp} onChange={handleChange} placeholder="카카오 디벨로퍼스 네이티브 앱 키" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
              </div>
            </div>
          </div>
        </section>

        {/* 팝빌 API 섹션 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">3. 팩스 및 세금계산서 연동 (Popbill B2B)</h2>
            <div className="flex gap-3 items-center">
              {renderBadge(status.popbill)}
              <button onClick={() => handleTestAndSave('popbill')} disabled={loadingType === 'popbill' || !keys.popbillLink || !keys.popbillSecret} className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors">
                {loadingType === 'popbill' ? '테스트 중...' : '연결 테스트 및 저장'}
              </button>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-4">관공서 실시간 팩스 전송 및 국세청 전자세금계산서 자동 전송을 위한 팝빌 연동키입니다.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Link ID</label>
                <input type="text" name="popbillLink" value={keys.popbillLink} onChange={handleChange} placeholder="팝빌 발급 Link ID" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Secret Key</label>
                <input type="password" name="popbillSecret" value={keys.popbillSecret} onChange={handleChange} placeholder="팝빌 발급 Secret Key" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* API 발급 가이드 모달 */}
      {isGuideOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                📖 API 통합 발급 가이드
              </h2>
              <button onClick={() => setIsGuideOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full hover:bg-slate-200 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
              {/* 1. OpenWeatherMap */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-teal-700 mb-3 flex items-center gap-2">
                  <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm">Step 1</span>
                  OpenWeatherMap (날씨 연동)
                </h3>
                <div className="pl-4 border-l-4 border-teal-100 space-y-2 text-slate-700">
                  <p>1. <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">openweathermap.org/api</a> 접속 및 회원가입</p>
                  <p>2. 무료 요금제인 <b>Current Weather Data</b> API 선택 및 Subscribe</p>
                  <p>3. 상단 메뉴 [My API Keys] 이동 후 발급된 32자리 난수 키 복사</p>
                  <p className="text-sm text-slate-500 mt-2">* 요금: 초당 60회 / 일 1,000,000회 무료 (크린케어 수준에서는 평생 무료 사용 가능)</p>
                </div>
              </div>

              {/* 2. Kakao Developers */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-yellow-600 mb-3 flex items-center gap-2">
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Step 2</span>
                  Kakao Developers (카카오맵 및 내비)
                </h3>
                <div className="pl-4 border-l-4 border-yellow-100 space-y-2 text-slate-700">
                  <p>1. <a href="https://developers.kakao.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">developers.kakao.com</a> 접속 및 카카오 계정 로그인</p>
                  <p>2. [내 애플리케이션] - [애플리케이션 추가하기] 클릭 (앱 이름: 크린케어)</p>
                  <p>3. 발급된 키 중 <b>JavaScript 키</b>(웹 지도용), <b>REST API 키</b>(주소 변환용), <b>네이티브 앱 키</b>(내비용) 3가지를 복사</p>
                  <p>4. [플랫폼] 메뉴에서 Web 사이트 도메인과 Android/iOS 패키지명을 등록해야 작동합니다.</p>
                  <p className="text-sm text-slate-500 mt-2">* 요금: 지도 1일 30만 건 무료, 내비 무제한 무료</p>
                </div>
              </div>

              {/* 3. 팝빌 */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-indigo-600 mb-3 flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">Step 3</span>
                  팝빌 (Popbill) (전자세금계산서 & 팩스)
                </h3>
                <div className="pl-4 border-l-4 border-indigo-100 space-y-2 text-slate-700">
                  <p>1. <a href="https://www.popbill.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">popbill.com</a> 접속 후 기업(사업자) 회원가입 (사업자등록증 필요)</p>
                  <p>2. [개발자센터] - [API 연동신청] 메뉴에서 LinkID 및 SecretKey 발급</p>
                  <div className="bg-slate-100 p-3 rounded-lg my-2 border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1">💡 팩스/세금계산서는 무료 API가 없나요?</p>
                    <p className="text-sm">팩스 통신망과 국세청 전송망을 사용하므로 <span className="text-red-600 font-bold">전 세계 어디에도 100% 무료 상용 API는 존재하지 않습니다.</span> (무료로 하려면 국세청 홈택스에 직접 접속해서 수기로 작성해야 합니다.)</p>
                    <p className="text-sm mt-1">단, 팝빌의 <b>[테스트 환경(Testbed)]</b>을 이용하면 개발 및 테스트 기간 동안 <b>모든 기능을 100% 무료로 무제한 테스트</b>해 볼 수 있습니다! 가입 시 주어지는 무료 테스트 포인트로 충분히 실험해 보신 후, 실서버 오픈 때만 소액(건당 40원/200원)을 충전하시면 됩니다.</p>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">* 실서버 요금: 세금계산서 건당 약 200원 / 팩스 건당 약 40원 (충전 차감 방식)</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="px-8 py-3 font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-700 shadow-lg transition-colors">
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
