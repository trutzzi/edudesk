import type { Role } from '@/features/auth/AuthProvider';
import { distinctColors, type Color } from '@/lib/colors';
import { toMinutes } from '@/lib/dates/time';
import { fullName } from '@/lib/people';
import type { Lesson, SchoolEvent } from '@/lib/types/school';

export type Now = { day: string; minutes: number } | null;

// Everything the week, month and phone views need to draw lessons the same way
export interface TimetableView {
  lessons: Lesson[];
  lessonsOn: (day: string) => Lesson[];
  eventsOn: (day: string) => SchoolEvent[];
  holidayOn: (day: string) => SchoolEvent | undefined;
  colorOf: (lesson: Lesson) => Color;
  // The line under a lesson's name: which class for teachers, which teacher for students and parents
  detailOf: (lesson: Lesson) => string;
  isLive: (lesson: Lesson) => boolean;
  now: Now;
}

export function buildView(lessons: Lesson[], events: SchoolEvent[], role: Role | undefined, now: Now): TimetableView {
  const byDay = new Map<string, Lesson[]>();
  for (const lesson of lessons) byDay.set(lesson.date, [...(byDay.get(lesson.date) ?? []), lesson]);

  // Each subject keeps its own color, so the timetable reads at a glance
  const colors = distinctColors(lessons.map((lesson) => lesson.courseName));
  // Parents see the same as students; the class only matters when lessons come from several (more than one child)
  const severalClasses = new Set(lessons.map((lesson) => lesson.class.id)).size > 1;
  const eventsOn = (day: string) => events.filter((event) => event.startDate <= day && day <= event.endDate);

  return {
    lessons,
    lessonsOn: (day) => byDay.get(day) ?? [],
    eventsOn,
    holidayOn: (day) => eventsOn(day).find((event) => event.kind === 'holiday'),
    colorOf: (lesson) => colors.get(lesson.courseName)!,
    detailOf: (lesson) =>
      role === 'teacher'
        ? lesson.class.name
        : severalClasses
          ? `${lesson.class.name} · ${fullName(lesson.teacher)}`
          : fullName(lesson.teacher),
    isLive: (lesson) =>
      Boolean(now && lesson.date === now.day && toMinutes(lesson.startTime) <= now.minutes && now.minutes < toMinutes(lesson.endTime)),
    now,
  };
}
