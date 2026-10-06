// A therapy (specialization) the institution offers, as /api/therapies lists it
export interface Therapy {
  id: string;
  name: string;
  coursesCount: number;
  therapistsCount: number;
}
