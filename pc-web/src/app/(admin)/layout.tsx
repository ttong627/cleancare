'use client';

import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (userData?.role === 'PENDING' || userData?.isActive === false) {
        router.replace('/pending');
      }
    }
  }, [user, userData, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return null; // 리다이렉트 중 깜빡임 방지
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 40%, #e8f4ff 70%, #ede9fe 100%)' }}>
      {/* 배경 오브 */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-x-hidden relative z-10">
        {children}
      </main>
    </div>
  );
}
