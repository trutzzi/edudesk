export const DEMO_CODE = 'DEMO';
export const SCHOOL_YEAR = '2026-2027';
export const CLASS_NAME_CANDIDATES = [
  'Sala Albastră',
  'Sala Verde',
  'Sala Galbenă',
  'Sala Portocalie',
  'Sala Mov',
  'Sala Roz',
  'Sala Turcoaz',
  'Sala Gri',
];
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
}

// The therapies every room runs. Therapies in one unit share the same weekly slots: Occupational therapy runs
// in the first semester and Psychotherapy in the second, in the same hours, which the clash rules allow.
export const UNITS: { subjects: Subject[]; hoursPerWeek: number }[] = [
  { subjects: [{ name: 'Kineto', teacher: 'elena', dates: YEAR }], hoursPerWeek: 4 },
  { subjects: [{ name: 'Logopedie', teacher: 'mihai', dates: YEAR }], hoursPerWeek: 4 },
  { subjects: [{ name: 'ABA', teacher: 'sarah', dates: YEAR }], hoursPerWeek: 3 },
  {
    subjects: [
      { name: 'Terapie Ocupațională', teacher: 'andrei', dates: SEMESTER_1 },
      { name: 'Psihoterapie', teacher: 'andrei', dates: SEMESTER_2 },
    ],
    hoursPerWeek: 2,
  },
  { subjects: [{ name: 'Coordonare', teacher: 'ioana', dates: YEAR }], hoursPerWeek: 2 },
  { subjects: [{ name: 'Consiliere Psihologică', teacher: 'dan', dates: MODULE }], hoursPerWeek: 1 },
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

// "Ana-Maria Voicu" → "ana-maria.voicu": email addresses don't do diacritics
export const emailName = (...parts: string[]) =>
  parts
    .join('.')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '.')
    .toLowerCase();

// Clients for a therapist's empty rooms, one list per room
export const TEACHER_CLASS_STUDENTS = [
  ['Mara Ilie', 'Rareș Cojocaru', 'Ilinca Dobre', 'Sebastian Mitroi', 'Sofia Pârvu', 'Darius Enache', 'Patricia Lupu'],
  ['Bogdan Tănase', 'Clara Vlad', 'Horia Neacșu', 'Diana Costache', 'Nicolas Avram', 'Ruxandra Iancu', 'Tiberiu Manole'],
];
// Therapies a therapist takes on in rooms they don't work in yet; none of the UNITS, so they can't clash by name
export const EXTRA_COURSES = [{ name: 'Nirvana', hoursPerWeek: 2 }];

// The sample accounts' password: SEED_PASSWORD when set (production requires it), else a well-known one
export const DEV_PASSWORD = 'password123';
export const samplePassword = () => process.env.SEED_PASSWORD || DEV_PASSWORD;
// How the console names it, so a chosen password never ends up in logs
export const passwordHint = () => (process.env.SEED_PASSWORD ? 'the SEED_PASSWORD' : DEV_PASSWORD);
