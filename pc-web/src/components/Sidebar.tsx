'use client';

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Users, Settings, LogOut, Printer, Key, Briefcase, UserCog, FileText, MoreVertical, User as UserIcon, Smartphone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Sidebar() {
  const pathname = usePathname();
  const { userData } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const mainNavItems = [
    { name: '실시간 관제 대시보드', href: '/', icon: LayoutDashboard },
    { name: '작업 현장 및 일정 관리', href: '/assignments', icon: Briefcase },
    { name: '정산 및 전자세금계산서', href: '/settlement', icon: Receipt },
    { name: '현장 작업자 관리', href: '/workers', icon: Users },
    { name: '관공서 팩스 일괄 전송', href: '/fax', icon: Printer },
    { name: '작업 보고서 및 출력 관리', href: '/reports', icon: FileText },
    { name: '작업자 모바일 앱', href: '/mobile', icon: Smartphone },
  ];

  const adminMenu = [
    { name: '사용자 및 권한 관리', href: '/users', icon: UserCog },
    { name: '외부 API 연동 설정', href: '/settings/api', icon: Key },
    { name: '시스템 환경 설정', href: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    if (confirm('시스템에서 로그아웃 하시겠습니까?')) {
      const { signOut } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      signOut(auth);
    }
  };

  return (
    <div
      className="w-64 h-screen fixed left-0 top-0 flex flex-col z-20"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(14,165,233,0.15)',
        boxShadow: '4px 0 32px rgba(14,165,233,0.12), 2px 0 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* 로고 영역 */}
      <div
        className="p-5 flex flex-col items-center"
        style={{ borderBottom: '1px solid rgba(14,165,233,0.12)' }}
      >
        <div
          className="w-full h-16 rounded-2xl p-2 flex items-center justify-center mb-3"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            boxShadow: '0 8px 24px rgba(14,165,233,0.4), 0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          <img src="/logo1.png" alt="Clean Care Logo" className="w-full h-full object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
        </div>
        <p
          className="text-xs font-bold tracking-wider"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          통합 관제 시스템 V3.0
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group"
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(99,102,241,0.12) 100%)',
                border: '1px solid rgba(14,165,233,0.3)',
                boxShadow: '0 4px 16px rgba(14,165,233,0.2), inset 0 1px 0 rgba(255,255,255,0.6)',
                color: '#0369a1',
              } : {
                color: '#475569',
                border: '1px solid transparent',
              }}
            >
              <div
                className="p-1.5 rounded-lg transition-all"
                style={isActive ? {
                  background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                  boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
                } : {
                  background: 'rgba(14,165,233,0.08)',
                }}
              >
                <Icon
                  size={16}
                  style={{ color: isActive ? '#ffffff' : '#64748b' }}
                />
              </div>
              <span className="font-semibold text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* 사용자 프로필 & 3-dots 메뉴 (하단 고정) */}
      <div className="relative p-4" style={{ borderTop: '1px solid rgba(14,165,233,0.12)' }}>
        {/* 팝업 메뉴 */}
        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
            <div className="absolute bottom-20 left-4 w-[230px] bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div className="px-3 py-2 text-xs font-bold text-slate-400">내 정보</div>
              <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <UserIcon size={16} className="text-indigo-500" />
                계정 관리 (비밀번호 변경)
              </Link>
              
              {(userData?.role === 'MASTER' || userData?.role === 'ADMIN') && (
                <>
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 mt-2 border-t border-slate-50 pt-3">관리자 메뉴</div>
                  {adminMenu.map(item => (
                    <Link key={item.name} href={item.href} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                      <item.icon size={16} className="text-slate-500" />
                      {item.name}
                    </Link>
                  ))}
                </>
              )}

              <div className="border-t border-slate-50 mt-2 pt-2">
                <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left">
                  <LogOut size={16} />
                  시스템 로그아웃
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className="flex items-center gap-3 truncate">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
              {userData?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm text-slate-800 truncate">{userData?.name || '사용자'}</span>
              <span className="text-xs text-slate-500 font-medium">{userData?.role === 'MASTER' ? '최고 관리자' : userData?.role === 'ADMIN' ? '일반 관리자' : '현장 작업자'}</span>
            </div>
          </div>
          <div className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors">
            <MoreVertical size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
