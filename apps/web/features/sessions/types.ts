// Shapes returned by the backend's /api/attendance, /api/clients and /api/reports routes
import type { PaymentType } from '@/features/people/types';
import type { Person } from '@/lib/people';

export const ATTENDANCE_STATUSES = ['present', 'absent_notice', 'absent_late', 'cancelled'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// The session a client has just before or after another one the same day
export interface Neighbour {
  courseName: string;
  startTime: string;
  endTime: string;
  teacher: Person;
}

export interface Roster {
  courseId: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  room: string | null;
  class: { id: string; name: string };
  teacher: Person;
  clients: { client: Person; status: AttendanceStatus; markedAt: string | null; before: Neighbour | null; after: Neighbour | null }[];
}

export interface AttendanceDay {
  date: string;
  today: string;
  // Sessions can be marked once they've happened
  editable: boolean;
  sessions: Roster[];
}

export interface ClientSession {
  courseId: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  room: string | null;
  class: { id: string; name: string };
  teacher: Person;
  status: AttendanceStatus;
}

export interface ClientProfile extends Person {
  email: string | null;
  phone: string | null;
  // Hidden (null) when the client looks at their own card
  paymentType: PaymentType | null;
  details: string | null;
  notes: string | null;
  rooms: { id: string; name: string }[];
}

export interface Report {
  month: string;
  clients: { client: Person; sessions: number; hours: number; counts: Record<AttendanceStatus, number>; therapies: string[] }[];
  therapists: { teacher: Person; sessions: number; hours: number }[];
}
