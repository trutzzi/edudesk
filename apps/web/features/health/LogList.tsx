'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormError } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { LEVEL_STYLE, type LogEntry } from './types';

type Filter = 'all' | 'error' | 'warn' | 'web';
const FILTERS: Filter[] = ['all', 'error', 'warn', 'web'];

const queryFor = (filter: Filter) => (filter === 'all' ? '' : filter === 'web' ? 'source=web' : `level=${filter}`);

interface Page {
  entries: LogEntry[];
  hasMore: boolean;
}

// The newest log entries, filterable, 50 at a time
export function LogList({ refreshKey }: { refreshKey: number }) {
  const t = useTranslations('Health');
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <section aria-labelledby="log-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="log-title" className="text-sm font-semibold text-slate-700">
          {t('log')}
        </h3>
        <SegmentedControl
          label={t('log')}
          size="xs"
          value={filter}
          onChange={setFilter}
          segments={FILTERS.map((value) => ({ value, label: t(`filters.${value}`) }))}
        />
      </div>
      {/* A new filter or a refresh starts a fresh list */}
      <Entries key={`${filter}-${refreshKey}`} query={queryFor(filter)} />
    </section>
  );
}

function Entries({ query }: { query: string }) {
  const t = useTranslations('Health');
  const format = useFormatter();
  const first = useApi<Page>(`/api/monitoring/logs?${query}`);
  const { send, pending, error } = useSend();
  // Pages loaded with "Load more", after the first
  const [more, setMore] = useState<Page[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  if (!first.data) return <Skeleton className="h-40 rounded-xl bg-slate-100" />;

  const entries = [first.data, ...more].flatMap((page) => page.entries);
  const hasMore = (more.at(-1) ?? first.data).hasMore;

  async function loadMore() {
    const before = entries.at(-1)?.id;
    const result = await send<Page>(`/api/monitoring/logs?${query}${query ? '&' : ''}before=${before}`);
    if (result.ok) setMore((pages) => [...pages, result.data]);
  }

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (entries.length === 0) return <EmptyState>{t('noEntries')}</EmptyState>;

  return (
    <>
      <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {entries.map((entry) => {
          const style = LEVEL_STYLE[entry.level];
          return (
            <li key={entry.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                  <span aria-hidden>{style.icon}</span>
                  {entry.level === 'error' ? t('levelError') : t('levelWarn')}
                </span>
                <time dateTime={entry.createdAt} className="text-xs text-slate-500 tabular-nums">
                  {format.dateTime(new Date(entry.createdAt), { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </time>
                {entry.source === 'web' ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{t('filters.web')}</span>
                ) : (
                  <span className="font-mono text-xs font-semibold text-slate-700">{entry.status}</span>
                )}
                <code className="min-w-0 truncate font-mono text-xs text-slate-700">
                  {entry.method && `${entry.method} `}
                  {entry.path}
                </code>
                {entry.durationMs !== null && entry.durationMs >= 1000 && (
                  <span className="text-xs text-slate-500">{t('slowBy', { ms: entry.durationMs })}</span>
                )}
                <span className="ml-auto text-xs text-slate-500">{entry.user ? entry.user.name : t('signedOut')}</span>
              </div>
              {entry.message && (
                <p className="text-slate-700">
                  {entry.message}
                  {entry.code && <span className="ml-2 font-mono text-xs text-slate-400">{entry.code}</span>}
                </p>
              )}
              {entry.detail && (
                <>
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-expanded={open.has(entry.id)}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {t('details')}
                  </button>
                  {open.has(entry.id) && (
                    <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{entry.detail}</pre>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
      <FormError message={error} />
      {hasMore && (
        <button type="button" onClick={loadMore} disabled={pending} className={buttonClass('secondary', 'sm')}>
          {t('loadMore')}
        </button>
      )}
    </>
  );
}
