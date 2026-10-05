import { isTimeString } from '../../lib/validation.js';

export const MAX_LESSONS_PER_COURSE = 50;

// One weekly slot of a course, as the API receives it
export interface WeeklyLesson {
  // ISO weekday: 1 = Monday … 7 = Sunday
  weekday: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}

export const isWeeklyLesson = (value: unknown): value is WeeklyLesson => {
  const lesson = value as WeeklyLesson;
  return (
    typeof lesson === 'object' &&
    lesson !== null &&
    Number.isInteger(lesson.weekday) &&
    lesson.weekday >= 1 &&
    lesson.weekday <= 7 &&
    isTimeString(lesson.startTime) &&
    isTimeString(lesson.endTime) &&
    // "HH:MM" strings sort the same way as the times they describe
    lesson.startTime < lesson.endTime &&
    (lesson.room === null || lesson.room === undefined || (typeof lesson.room === 'string' && lesson.room.length <= 50))
  );
};
