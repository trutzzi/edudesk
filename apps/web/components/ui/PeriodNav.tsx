'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { buttonClass } from './button';

interface Props {
  label: ReactNode;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  // "Today", "This week"…: whatever brings the view back to now
  todayLabel?: string;
}

// 44px squares on phones, so the arrows are easy to hit with a thumb
const arrowClass =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:h-9 sm:w-9 sm:text-base';

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
      <h2 className="text-base font-bold first-letter:uppercase sm:text-lg" aria-live="polite">
        {label}
      </h2>
    </>
  );
}
