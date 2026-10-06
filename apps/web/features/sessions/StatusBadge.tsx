'use client';

import { useTranslations } from 'next-intl';
import type { AttendanceStatus } from './types';

export const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  absent_notice: 'bg-amber-50 text-amber-700',
  absent_late: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  const t = useTranslations('Attendance.statuses');
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{t(status)}</span>;
}
