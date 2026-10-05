export const DEMO_CODE = 'DEMO';
export const SCHOOL_YEAR = '2026-2027';
export const CLASS_NAME_CANDIDATES = ['9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'];
export const CLASSES_TO_ADD = 4;

// Demo dates for 2026-2027: the full year, two semesters and a short optional module
export const YEAR = { start: '2026-09-07', end: '2027-06-18' };
export const SEMESTER_1 = { start: '2026-09-07', end: '2027-01-29' };
export const SEMESTER_2 = { start: '2027-02-08', end: '2027-06-18' };
export const MODULE = { start: '2026-10-05', end: '2026-12-18' };

export const TEACHERS = {
  elena: ['Elena', 'Popescu'],
  mihai: ['Mihai', 'Ionescu'],
  sarah: ['Sarah', 'Miller'],
  andrei: ['Andrei', 'Vasile'],
  ioana: ['Ioana', 'Radu'],
  dan: ['Dan', 'Stoica'],
} as const;
export type TeacherKey = keyof typeof TEACHERS;

export interface Subject {
  name: string;
  teacher: TeacherKey;
  dates: { start: string; end: string };
  room?: string;
}

// What every class studies. Subjects in one unit share the same weekly slots: Physics runs in the
// first semester and Chemistry in the second, in the same hours, which the clash rules allow.
export const UNITS: { subjects: Subject[]; hoursPerWeek: number }[] = [
  { subjects: [{ name: 'Matematică', teacher: 'elena', dates: YEAR }], hoursPerWeek: 4 },
  { subjects: [{ name: 'Limba română', teacher: 'mihai', dates: YEAR }], hoursPerWeek: 4 },
  { subjects: [{ name: 'English', teacher: 'sarah', dates: YEAR }], hoursPerWeek: 3 },
  {
    subjects: [
      { name: 'Fizică', teacher: 'andrei', dates: SEMESTER_1, room: 'Laborator' },
      { name: 'Chimie', teacher: 'andrei', dates: SEMESTER_2, room: 'Laborator' },
    ],
    hoursPerWeek: 2,
  },
  { subjects: [{ name: 'Istorie', teacher: 'ioana', dates: YEAR }], hoursPerWeek: 2 },
  { subjects: [{ name: 'Informatică', teacher: 'dan', dates: YEAR, room: 'Sala IT' }], hoursPerWeek: 2 },
  { subjects: [{ name: 'Robotică', teacher: 'sarah', dates: MODULE, room: 'Sala IT' }], hoursPerWeek: 1 },
];

export const PERIODS = [
  ['08:00', '08:50'],
  ['09:00', '09:50'],
  ['10:00', '10:50'],
  ['11:00', '11:50'],
  ['12:00', '12:50'],
  ['13:00', '13:50'],
] as const;
export const WEEKDAYS = 5;

// Seven students for each class added, in order
export const STUDENTS = [
  ['Andrei Dumitru', 'Ioana Stan', 'Radu Marin', 'Maria Gheorghe', 'Ștefan Popa', 'Elena Nistor', 'Matei Oprea'],
  ['Alexandru Rusu', 'Ana Matei', 'David Constantin', 'Carla Neagu', 'Victor Sima', 'Larisa Petcu', 'Eric Toma'],
  ['Daria Lungu', 'Vlad Ciobanu', 'Bianca Tudor', 'Tudor Iordache', 'Sara Munteanu', 'Luca Barbu', 'Irina Moldovan'],
  ['Mihnea Florea', 'Alexia Pavel', 'Robert Stoica', 'Teodora Ene', 'Gabriel Dinu', 'Ana-Maria Voicu', 'Cosmin Lazăr'],
];
// The first student of each class gets a parent account, with these first names
export const PARENT_FIRST_NAMES = ['Cristina', 'Adrian', 'Monica', 'Florin'];

// "Ana-Maria Voicu" → "ana-maria.voicu": email addresses don't do diacritics
export const emailName = (...parts: string[]) =>
  parts
    .join('.')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '.')
    .toLowerCase();

// Students for a teacher's empty classes, one list per class; the first in each also gets a parent
export const TEACHER_CLASS_STUDENTS = [
  ['Mara Ilie', 'Rareș Cojocaru', 'Ilinca Dobre', 'Sebastian Mitroi', 'Sofia Pârvu', 'Darius Enache', 'Patricia Lupu'],
  ['Bogdan Tănase', 'Clara Vlad', 'Horia Neacșu', 'Diana Costache', 'Nicolas Avram', 'Ruxandra Iancu', 'Tiberiu Manole'],
];
export const TEACHER_CLASS_PARENTS = ['Gabriela', 'Sorin'];
// Courses a teacher takes on in classes they don't teach yet
export const EXTRA_COURSES = [
  { name: 'Biologie', hoursPerWeek: 2 },
  { name: 'Geografie', hoursPerWeek: 1 },
];
