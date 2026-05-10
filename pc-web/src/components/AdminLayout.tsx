'use client';

import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { LayoutDashboard, Briefcase, Receipt, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (userData?.role === 'PENDING' || userData?.isActive === false) {
        router.replace('/pending');
      }
    }
  }, [user, userData, loading, router]);

  const mainContent = (loading || !user)
    ? <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>
    : children;

  const mobileNav = [
    { name: '홈', href: '/', icon: LayoutDashboard },
    { name: '현장·일정', href: '/assignments', icon: Briefcase },
    { name: '정산', href: '/settlement', icon: Receipt },
    { name: '메뉴', href: '/workers', icon: MoreHorizontal }, // 향후 모바일 전체 메뉴로 연결
  ];

  return (
    <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 40%, #e8f4ff 70%, #ede9fe 100%)' }}>
      {/* 배경 오브 */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      <Sidebar />
      <main className="flex-1 md:ml-64 w-full min-h-screen overflow-x-hidden relative z-10 pb-20 md:pb-0">
        {mainContent}
      </main>
      
      {/* 모바일 하단 네비게이션 바 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-50 flex justify-around items-center px-2 pb-safe" style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.05)' }}>
        {mobileNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
              <item.icon size={22} className={isActive ? 'fill-blue-100' : ''} />
              <span className="text-[10px] font-bold">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
