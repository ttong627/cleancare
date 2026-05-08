'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Invoice } from '@/schema';
import { TrendingUp, BarChart2, PieChart as PieIcon } from 'lucide-react';

interface MonthlyChartProps {
  invoices: Invoice[];
}

const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const PAYMENT_COLORS = { PAID: '#10b981', PARTIAL: '#f59e0b', UNPAID: '#ef4444' };
const PAYMENT_LABELS = { PAID: '결제완료', PARTIAL: '부분납부', UNPAID: '미수' };

function formatKRW(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
  return value.toLocaleString();
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-4 py-3 rounded-xl shadow-xl" style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-white font-bold text-sm mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-bold">{typeof p.value === 'number' && p.name.includes('원') ? `${p.value.toLocaleString()}원` : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function MonthlyChart({ invoices }: MonthlyChartProps) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 최근 6개월 월별 발행액 & 건수
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(currentYear, now.getMonth() - 5 + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthInvoices = invoices.filter(inv => {
        const id = new Date(inv.issuedAt);
        return id.getFullYear() === year && id.getMonth() === month && inv.status !== 'CANCELLED';
      });
      const totalAmount = monthInvoices.reduce((s, inv) => s + (inv.totalAmount ?? inv.amount), 0);
      const count = monthInvoices.length;
      return {
        month: `${MONTHS_KO[month]}`,
        발행액: totalAmount,
        발행건수: count,
      };
    });
  }, [invoices, currentYear]);

  // 결제 상태 파이 차트 데이터
  const paymentPieData = useMemo(() => {
    const counts = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
    invoices.forEach(inv => {
      const s = inv.paymentStatus ?? 'UNPAID';
      if (s in counts) counts[s as keyof typeof counts]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: PAYMENT_LABELS[key as keyof typeof PAYMENT_LABELS],
        value,
        color: PAYMENT_COLORS[key as keyof typeof PAYMENT_COLORS],
      }));
  }, [invoices]);

  // 이번달 통계
  const thisMonth = useMemo(() => {
    const m = invoices.filter(inv => {
      const d = new Date(inv.issuedAt);
      return d.getFullYear() === currentYear && d.getMonth() === now.getMonth() && inv.status !== 'CANCELLED';
    });
    return {
      total: m.reduce((s, inv) => s + (inv.totalAmount ?? inv.amount), 0),
      count: m.length,
      paid: m.filter(inv => inv.paymentStatus === 'PAID').length,
    };
  }, [invoices, currentYear]);

  const maxAmount = Math.max(...monthlyData.map(d => d['발행액']), 1);

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '이번달 발행액', value: `${formatKRW(thisMonth.total)}원`, sub: `${thisMonth.count}건 발행`, icon: <TrendingUp size={18} />, color: '#10b981' },
          { label: '이번달 발행 건수', value: `${thisMonth.count}건`, sub: `전월 대비`, icon: <BarChart2 size={18} />, color: '#0ea5e9' },
          { label: '결제 완료 건수', value: `${thisMonth.paid}건`, sub: `미수 ${thisMonth.count - thisMonth.paid}건`, icon: <PieIcon size={18} />, color: '#6366f1' },
        ].map((item, i) => (
          <div key={i} className="p-4 rounded-2xl" style={{ background: `${item.color}10`, border: `1px solid ${item.color}25` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: item.color }}>
              {item.icon}
              <span className="text-xs font-bold">{item.label}</span>
            </div>
            <p className="text-2xl font-black text-white">{item.value}</p>
            <p className="text-xs mt-0.5" style={{ color: `${item.color}99` }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* 월별 발행액 바 차트 */}
      <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-blue-400" /> 월별 발행액 추이 (최근 6개월)
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatKRW} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={52} domain={[0, maxAmount * 1.15]} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
            <Bar dataKey="발행액" name="발행액(원)" radius={[6, 6, 0, 0]}
              fill="url(#barGradient)" />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 발행 건수 라인 차트 + 결제상태 파이 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" /> 월별 발행 건수
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="발행건수" name="발행건수" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-purple-400" /> 전체 결제 현황
          </h4>
          {paymentPieData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {paymentPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [String(value) + '건', '']} contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#cbd5e1' }} />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
