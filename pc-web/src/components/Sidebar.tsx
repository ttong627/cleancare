'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Users, Settings, LogOut, Printer, Key, Briefcase, UserCog } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: '실시간 관제 대시보드', href: '/', icon: LayoutDashboard },
    { name: '작업 현장 및 일정 관리', href: '/assignments', icon: Briefcase },
    { name: '정산 및 전자세금계산서', href: '/settlement', icon: Receipt },
    { name: '현장 작업자 관리', href: '/workers', icon: Users },
    { name: '사용자 및 권한 관리', href: '/users', icon: UserCog },
    { name: '관공서 팩스 일괄 전송', href: '/fax', icon: Printer },
    { name: '외부 API 연동 설정', href: '/settings/api', icon: Key },
    { name: '시스템 환경 설정', href: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 h-screen fixed left-0 top-0 flex flex-col shadow-2xl">
      <div className="p-6 border-b border-slate-800 flex flex-col items-center justify-center">
        {/* 실제 로고 이미지 적용 (logo1.png) */}
        <div className="w-full h-16 bg-white rounded-xl p-2 flex items-center justify-center mb-3 shadow-lg shadow-teal-500/10">
          <img src="/logo1.png" alt="Clean Care Logo" className="w-full h-full object-contain" />
        </div>
        <p className="text-slate-500 text-xs font-medium">통합 관제 시스템 V3.0</p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-teal-400 border border-teal-500/30' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon 
                size={20} 
                className={isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'} 
              />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors">
          <LogOut size={20} />
          <span className="font-medium text-sm">시스템 로그아웃</span>
        </button>
      </div>
    </div>
  );
}
