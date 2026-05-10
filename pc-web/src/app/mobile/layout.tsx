import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '크린케어 현장 앱',
  description: '현장 작업자 전용 촬영 및 관리 앱',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '크린케어',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#080c14',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#080c14',
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        overscrollBehavior: 'none',
      }}
    >
      {children}
    </div>
  );
}
