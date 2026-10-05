import { PERIODS, UNITS, WEEKDAYS } from './data.js';

export interface Slot {
  weekday: number;
  period: number;
}

// Places every unit's weekly hours for every class so that no teacher and no class is booked twice
// at the same time. Greedy, with each class and unit starting from a different slot so the week fills
// evenly; a unit's hours go on different days where possible.
export function buildTimetable(classCount: number) {
  const teacherBusy = new Set<string>();
  const timetable: { classIndex: number; unitIndex: number; slot: Slot }[] = [];
  const slotCount = WEEKDAYS * PERIODS.length;

  for (let classIndex = 0; classIndex < classCount; classIndex++) {
    const classBusy = new Set<string>();

    UNITS.forEach((unit, unitIndex) => {
      const teachers = [...new Set(unit.subjects.map((subject) => subject.teacher))];
      const offset = classIndex * 7 + unitIndex * 11;
      const daysUsed = new Set<number>();
      let placed = 0;

      // First try one hour per day, then allow doubling up on a day
      for (const spreadAcrossDays of [true, false]) {
        for (let i = 0; i < slotCount && placed < unit.hoursPerWeek; i++) {
          const index = (offset + i) % slotCount;
          const slot = { weekday: (index % WEEKDAYS) + 1, period: Math.floor(index / WEEKDAYS) };
          const key = `${slot.weekday}-${slot.period}`;
          if (classBusy.has(key) || (spreadAcrossDays && daysUsed.has(slot.weekday))) continue;
          if (teachers.some((teacher) => teacherBusy.has(`${teacher}-${key}`))) continue;

          classBusy.add(key);
          teachers.forEach((teacher) => teacherBusy.add(`${teacher}-${key}`));
          daysUsed.add(slot.weekday);
          timetable.push({ classIndex, unitIndex, slot });
          placed++;
        }
      }
      if (placed < unit.hoursPerWeek) {
        throw new Error(`Could not fit ${unit.subjects[0]!.name} into the timetable of class ${classIndex + 1}`);
      }
    });
  }
  return timetable;
}

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// The periods (as indexes into PERIODS) on a weekday that don't overlap any of the given lessons
export function freePeriods(busy: { weekday: number; start_time: string; end_time: string }[], weekday: number) {
  return PERIODS.flatMap(([start, end], period) =>
    busy.some(
      (lesson) =>
        lesson.weekday === weekday && toMinutes(lesson.start_time) < toMinutes(end) && toMinutes(start) < toMinutes(lesson.end_time),
    )
      ? []
      : [period],
  );
}
