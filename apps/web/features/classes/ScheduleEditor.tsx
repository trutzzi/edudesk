'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { FormError } from '@/components/ui/Field';
import { compactControlClass } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessNote } from '@/components/ui/SuccessNote';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { addDays, parseDay } from '@/lib/dates/days';

interface Lesson {
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
}

// Loads the schedule, then hands it to the editor. Mounting the editor only once the data is there
// lets it start from that data, without copying it into state from an effect.
export function ScheduleEditor({ courseId, onSaved }: { courseId: string; onSaved: () => void }) {
  const lessons = useApi<Lesson[]>(`/api/courses/${courseId}/lessons`);

  if (!lessons.data) return <Skeleton className="h-24 rounded-xl bg-slate-100" />;
  return <ScheduleRows courseId={courseId} initial={lessons.data} onSaved={onSaved} />;
}

// Each row needs a stable key while rows are added and removed
let nextKey = 0;
type Row = Lesson & { key: number };
const withKey = (lesson: Lesson): Row => ({ ...lesson, key: nextKey++ });

function ScheduleRows({ courseId, initial, onSaved }: { courseId: string; initial: Lesson[]; onSaved: () => void }) {
  const t = useTranslations('Schedule');
  const format = useFormatter();
  const headingId = useId();
  const { send, pending, error } = useSend();
  const [rows, setRows] = useState<Row[]>(() => initial.map(withKey));
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // 5 Oct 2026 is a Monday, so these are Monday → Sunday in the current language
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(parseDay(addDays('2026-10-05', i)), { weekday: 'long', timeZone: 'UTC' }),
  );

  const update = (key: number, change: Partial<Lesson>) => {
    setSaved(false);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  };

  // A new lesson starts the day after the last one, at the same time
  const addLesson = () => {
    setSaved(false);
    setRows((current) => {
      const last = current.at(-1);
      return [
        ...current,
        withKey({
          weekday: last ? (last.weekday % 5) + 1 : 1,
          startTime: last?.startTime ?? '08:00',
          endTime: last?.endTime ?? '08:50',
          room: last?.room ?? null,
        }),
      ];
    });
  };

  async function save() {
    // "HH:MM" strings sort like the times they describe
    if (rows.some((row) => !row.startTime || !row.endTime || row.startTime >= row.endTime)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const lessons = rows.map(({ weekday, startTime, endTime, room }) => ({ weekday, startTime, endTime, room: room || null }));
    const result = await send(`/api/courses/${courseId}/lessons`, { method: 'PUT', body: { lessons } });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 id={headingId} className="text-sm font-bold">
        {t('title')}
      </h4>
      <FormError message={invalid ? t('invalid') : error} />

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-1 font-semibold">{t('weekday')}</th>
              <th className="pb-1 font-semibold">{t('start')}</th>
              <th className="pb-1 font-semibold">{t('end')}</th>
              <th className="pb-1 font-semibold">{t('room')}</th>
              <th className="pb-1">
                <span className="sr-only">{t('removeLesson')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="py-1 pr-2">
                  <select
                    aria-label={`${t('weekday')} ${index + 1}`}
                    value={row.weekday}
                    onChange={(event) => update(row.key, { weekday: Number(event.target.value) })}
                    className={`w-full ${compactControlClass} capitalize`}
                  >
                    {weekdays.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="time"
                    step={300}
                    aria-label={`${t('start')} ${index + 1}`}
                    value={row.startTime}
                    onChange={(event) => update(row.key, { startTime: event.target.value })}
                    className={`w-full ${compactControlClass}`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="time"
                    step={300}
                    aria-label={`${t('end')} ${index + 1}`}
                    value={row.endTime}
                    onChange={(event) => update(row.key, { endTime: event.target.value })}
                    className={`w-full ${compactControlClass}`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`${t('room')} ${index + 1}`}
                    value={row.room ?? ''}
                    placeholder={t('roomPlaceholder')}
                    maxLength={50}
                    onChange={(event) => update(row.key, { room: event.target.value })}
                    className={`w-full ${compactControlClass}`}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                    aria-label={`${t('removeLesson')} (${index + 1})`}
                    className="rounded-lg px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <span aria-hidden>✕</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addLesson} className={buttonClass('secondary', 'sm')}>
          + {t('addLesson')}
        </button>
        {saved && <SuccessNote>{t('saved')}</SuccessNote>}
        <button type="button" onClick={save} disabled={pending} className={`${buttonClass('primary', 'sm')} ml-auto`}>
          {pending ? t('saving') : t('save')}
        </button>
      </div>
    </section>
  );
}
