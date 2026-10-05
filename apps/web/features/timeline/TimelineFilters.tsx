'use client';

import { useTranslations } from 'next-intl';
import { compactControlClass } from '@/components/ui/Field';
import type { GroupBy } from './grouping';
import type { Zoom } from './ranges';

const ZOOMS: Zoom[] = ['term', 'month', 'week', 'day'];

interface Props {
  search: string;
  onSearch: (search: string) => void;
  groupBy: GroupBy;
  onGroupBy: (groupBy: GroupBy) => void;
  zoom: Zoom;
  onZoom: (zoom: Zoom) => void;
}

// Search, grouping and zoom, on the right of the timeline's toolbar
export function TimelineFilters({ search, onSearch, groupBy, onGroupBy, zoom, onZoom }: Props) {
  const t = useTranslations('Timeline');

  return (
    <div className="ml-auto flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
        className={`${compactControlClass} w-full font-normal sm:w-72`}
      />
      <label className="flex items-center gap-2 text-sm text-slate-500">
        {t('groupBy')}
        <select value={groupBy} onChange={(event) => onGroupBy(event.target.value as GroupBy)} className={compactControlClass}>
          <option value="class">{t('byClass')}</option>
          <option value="teacher">{t('byTeacher')}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-500">
        {t('zoom')}
        <select value={zoom} onChange={(event) => onZoom(event.target.value as Zoom)} className={compactControlClass}>
          {ZOOMS.map((value) => (
            <option key={value} value={value}>
              {t(`zooms.${value}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
