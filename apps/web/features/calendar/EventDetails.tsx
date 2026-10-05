'use client';

import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { useSend } from '@/lib/api/useSend';
import { EVENT_COLORS } from '@/lib/colors';
import type { SchoolEvent } from '@/lib/types/school';
import { useEventTitle } from '@/lib/useEventTitle';
import { useEventDates } from './useEventDates';

interface Props {
  event: SchoolEvent;
  // Admins can delete the school's own events; public holidays come from the country's list
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function EventDetails({ event, canDelete, onClose, onDeleted }: Props) {
  const t = useTranslations('Calendar');
  const eventTitle = useEventTitle();
  const eventDates = useEventDates();
  const { send, pending, error } = useSend();
  const color = EVENT_COLORS[event.kind];

  async function remove() {
    if ((await send(`/api/events/${event.id}`, { method: 'DELETE' })).ok) onDeleted();
  }

  return (
    <section
      aria-label={eventTitle(event)}
      className={`flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 p-4 shadow-sm ${color.soft}`}
    >
      <span className={`h-10 w-1.5 rounded-full ${color.bar}`} />
      <div className="min-w-0">
        <p className="font-bold">{eventTitle(event)}</p>
        <p className="text-sm text-slate-600">
          {event.national ? t('national') : `${t(`kinds.${event.kind}`)} · ${event.class?.name ?? t('wholeSchool')}`} · {eventDates(event)}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
      <div className="ml-auto flex gap-2">
        {canDelete && !event.national && (
          <button type="button" onClick={remove} disabled={pending} className={buttonClass('danger')}>
            {pending ? t('deleting') : t('delete')}
          </button>
        )}
        <button type="button" onClick={onClose} className={buttonClass('secondary')}>
          {t('close')}
        </button>
      </div>
    </section>
  );
}
