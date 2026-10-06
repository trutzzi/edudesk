import { pool } from '../../db/pool.js';

export interface Branding {
  appName: string | null;
  color: string | null;
  // Where the logo is served, with a version so a new logo is never a cached old one; null without a logo
  logoUrl: string | null;
}

export async function findBranding(schoolId: string) {
  const { rows } = await pool.query<Branding>(
    `SELECT app_name AS "appName", brand_color AS color,
            CASE WHEN logo IS NULL THEN NULL
                 ELSE '/api/schools/' || id || '/logo?v=' || EXTRACT(EPOCH FROM logo_updated_at)::bigint END AS "logoUrl"
     FROM schools WHERE id = $1`,
    [schoolId],
  );
  return rows[0];
}

// Changes only what's given; null resets it to the default look
export async function updateBranding(schoolId: string, changes: { appName?: string | null; color?: string | null }) {
  await pool.query(
    `UPDATE schools SET
       app_name    = CASE WHEN $2::boolean THEN $3 ELSE app_name END,
       brand_color = CASE WHEN $4::boolean THEN $5 ELSE brand_color END
     WHERE id = $1`,
    [schoolId, changes.appName !== undefined, changes.appName ?? null, changes.color !== undefined, changes.color ?? null],
  );
}

export async function saveLogo(schoolId: string, image: Buffer | null, type: string | null) {
  await pool.query('UPDATE schools SET logo = $2, logo_type = $3, logo_updated_at = now() WHERE id = $1', [schoolId, image, type]);
}

export async function findLogo(schoolId: string) {
  const { rows } = await pool.query<{ logo: Buffer; type: string }>(
    'SELECT logo, logo_type AS type FROM schools WHERE id = $1 AND logo IS NOT NULL',
    [schoolId],
  );
  return rows[0];
}
