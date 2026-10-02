'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';

interface Props {
  label: ReactNode;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  // "Today", "This week"…: whatever brings the view back to now
  todayLabel?: string;
}

const arrowClass = 'rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900';

// [Today] ‹ › Label — the navigation shared by the timeline, calendar and timetable.
// Renders side by side elements, so it sits inside the caller's toolbar row.
export function PeriodNav({ label, onToday, onPrevious, onNext, todayLabel }: Props) {
  const t = useTranslations('Common');

  return (
    <>
      <button type="button" onClick={onToday} className={buttonClass('secondary')}>
        {todayLabel ?? t('today')}
      </button>
      <div className="flex items-center">
        <button type="button" onClick={onPrevious} aria-label={t('previous')} className={arrowClass}>
          <span aria-hidden>‹</span>
        </button>
        <button type="button" onClick={onNext} aria-label={t('next')} className={arrowClass}>
          <span aria-hidden>›</span>
        </button>
      </div>
      <h2 className="text-lg font-bold first-letter:uppercase" aria-live="polite">
        {label}
      </h2>
    </>
  );
}
