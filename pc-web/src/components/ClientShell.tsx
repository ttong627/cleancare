'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

const PUBLIC_PATHS = ['/login', '/signup', '/pending', '/mobile', '/landing'];

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (isPublic) return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}
