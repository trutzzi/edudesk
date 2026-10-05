import { describe, expect, it } from 'vitest';
import { UNITS } from './data.js';
import { buildTimetable, freePeriods } from './timetable.js';

describe('buildTimetable', () => {
  const classCount = 4;
  const timetable = buildTimetable(classCount);

  it('gives every class every unit its weekly hours', () => {
    for (let classIndex = 0; classIndex < classCount; classIndex++) {
      UNITS.forEach((unit, unitIndex) => {
        const placed = timetable.filter((entry) => entry.classIndex === classIndex && entry.unitIndex === unitIndex);
        expect(placed).toHaveLength(unit.hoursPerWeek);
      });
    }
  });

  it('never books a class or a teacher twice in the same slot', () => {
    const classSlots = new Set<string>();
    const teacherSlots = new Set<string>();
    for (const { classIndex, unitIndex, slot } of timetable) {
      const key = `${slot.weekday}-${slot.period}`;
      expect(classSlots.has(`${classIndex}-${key}`)).toBe(false);
      classSlots.add(`${classIndex}-${key}`);
      for (const teacher of new Set(UNITS[unitIndex]!.subjects.map((subject) => subject.teacher))) {
        expect(teacherSlots.has(`${teacher}-${key}`)).toBe(false);
        teacherSlots.add(`${teacher}-${key}`);
      }
    }
  });
});

describe('freePeriods', () => {
  it('skips periods that overlap a lesson on that weekday', () => {
    const busy = [{ weekday: 1, start_time: '08:30', end_time: '09:20' }];

    // 08:00–08:50 and 09:00–09:50 both overlap 08:30–09:20
    expect(freePeriods(busy, 1)).toEqual([2, 3, 4, 5]);
    expect(freePeriods(busy, 2)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
