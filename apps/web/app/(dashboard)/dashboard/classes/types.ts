// Shapes returned by the backend's /api/classes and /api/users routes

export interface ClassSummary {
  id: string;
  name: string;
  schoolYear: string;
  studentsCount: number;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ClassCourse {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  teacherId: string;
  teacherFirstName: string;
  teacherLastName: string;
  lessonsCount: number;
}

export interface ClassDetails {
  id: string;
  name: string;
  schoolYear: string;
  students: Person[];
  courses: ClassCourse[];
}

// The school year a day falls in: from September onwards it's "this year–next year"
export function schoolYearOf(day: string) {
  const year = Number(day.slice(0, 4));
  return Number(day.slice(5, 7)) >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
