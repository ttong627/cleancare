'use client';

import Script from 'next/script';

export default function KakaoScript() {
  return (
    <Script
      src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services,clusterer&autoload=false`}
      strategy="afterInteractive"
      onError={(e) => {
        console.error('Kakao Maps Script Error', e);
        if (typeof window !== 'undefined') {
          (window as any).__kakao_error = true;
        }
      }}
    />
  );
}
