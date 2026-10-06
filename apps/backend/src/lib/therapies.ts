import type { PoolClient } from 'pg';

// The therapies a new institution starts with; its admins add, rename and remove from there
export const DEFAULT_THERAPIES = [
  'Kineto',
  'Logopedie',
  'ABA',
  'Terapie Ocupațională',
  'Nirvana',
  'Consiliere Psihologică',
  'Psihoterapie',
  'Coordonare',
  'Grup de dezvoltare',
  'Comunitate',
  'Shadow',
];

export async function insertDefaultTherapies(client: PoolClient, schoolId: string) {
  await client.query('INSERT INTO therapies (school_id, name) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [
    schoolId,
    DEFAULT_THERAPIES,
  ]);
}
