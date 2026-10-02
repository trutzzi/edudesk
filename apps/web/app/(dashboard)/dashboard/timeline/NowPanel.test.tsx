import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/lib/test-utils';
import { NowPanel } from './NowPanel';
import type { Lesson } from './types';

const lesson = (courseName: string, startTime: string, endTime: string): Lesson => ({
  id: courseName,
  courseId: courseName,
  courseName,
  date: '2026-10-02',
  startTime,
  endTime,
  room: 'Sala 101',
  class: { id: 'c9a', name: '9A' },
  teacher: { id: 't1', firstName: 'Elena', lastName: 'Popescu' },
});

const math = lesson('Matematică', '08:00', '08:50');
const romanian = lesson('Limba română', '09:00', '09:50');

describe('NowPanel', () => {
  it('lists the lessons in progress and the next one', () => {
    renderWithIntl(
      <NowPanel lessons={[math, romanian]} current={[math]} now={{ day: '2026-10-02', minutes: 8 * 60 + 20 }} loading={false} />,
    );

    expect(screen.getByText('Matematică')).toBeInTheDocument();
    expect(screen.getByText('until 08:50')).toBeInTheDocument();
    expect(screen.getByText('Next: Limba română · 9A at 09:00')).toBeInTheDocument();
  });

  it('says when the school day is over', () => {
    renderWithIntl(
      <NowPanel lessons={[math, romanian]} current={[]} now={{ day: '2026-10-02', minutes: 15 * 60 }} loading={false} />,
    );

    expect(screen.getByText('No lessons in progress right now.')).toBeInTheDocument();
    expect(screen.getByText('No more lessons today.')).toBeInTheDocument();
  });

  it('speaks Romanian', () => {
    renderWithIntl(<NowPanel lessons={[]} current={[]} now={{ day: '2026-10-03', minutes: 600 }} loading={false} />, 'ro');

    expect(screen.getByText('Nicio oră astăzi.')).toBeInTheDocument();
  });
});
