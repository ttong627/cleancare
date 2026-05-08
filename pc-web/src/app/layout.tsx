import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "크린케어 통합 관제센터",
  description: "크린케어 실시간 예외 관리 및 관제 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      </head>
      <body className={`${inter.className} antialiased bg-slate-900 text-slate-50`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: '!bg-slate-800 !text-white !border !border-slate-700',
              success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
