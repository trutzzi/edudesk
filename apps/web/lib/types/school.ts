// Shapes returned by the backend's /api/timeline and /api/events routes

interface Ref {
  id: string;
  name: string;
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CoursesResponse {
  timezone: string;
  courses: { id: string; name: string; startDate: string; endDate: string; class: Ref; teacher: Person }[];
}

export interface Lesson {
  id: string;
  courseId: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  class: Ref;
  teacher: Person;
}

export interface LessonsResponse {
  timezone: string;
  lessons: Lesson[];
}

export interface SchoolEvent {
  id: string;
  title: string;
  // Only on national public holidays: the English name
  englishTitle?: string;
  // National public holidays come from the country's list, not the school, and can't be edited here
  national?: boolean;
  kind: 'holiday' | 'exam' | 'trip' | 'meeting' | 'other';
  startDate: string;
  endDate: string;
  class: Ref | null;
}
