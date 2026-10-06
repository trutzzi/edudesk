import express from 'express';
import { authenticateJWT, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody, readId } from '../../http/query.js';
import { findBranding, findLogo, saveLogo, updateBranding } from './branding.repository.js';

const router = express.Router();

export const MAX_APP_NAME_LENGTH = 60;
export const MAX_LOGO_BYTES = 512 * 1024;
// Raster images only: an SVG can carry scripts, and the logo is served from the app's own address
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const NO_LOGO = 'This institution has no logo';

// GET /api/schools/branding: the caller's institution's name, color and logo
router.get('/branding', authenticateJWT, requireSchool, async (req: AuthenticatedRequest, res) => {
  res.json(await findBranding(schoolIdOf(req)));
});

// PATCH /api/schools/branding: { appName?, color? }; null or "" goes back to the default
router.patch('/branding', authenticateJWT, requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const body = readBody(req);
  const changes: { appName?: string | null; color?: string | null } = {};

  if (body.appName !== undefined) {
    const appName = typeof body.appName === 'string' ? body.appName.trim() : body.appName;
    if (appName !== null && (typeof appName !== 'string' || appName.length > MAX_APP_NAME_LENGTH)) {
      throw new HttpError(400, `The app name can have up to ${MAX_APP_NAME_LENGTH} characters`);
    }
    changes.appName = appName || null;
  }
  if (body.color !== undefined) {
    const color = typeof body.color === 'string' ? body.color.trim().toLowerCase() : body.color;
    if (color !== null && color !== '' && (typeof color !== 'string' || !COLOR_PATTERN.test(color))) {
      throw new HttpError(400, 'The color must look like #4f46e5');
    }
    changes.color = color || null;
  }

  const schoolId = schoolIdOf(req);
  await updateBranding(schoolId, changes);
  res.json(await findBranding(schoolId));
});

// PUT /api/schools/branding/logo: the image itself as the body, with its Content-Type
router.put(
  '/branding/logo',
  authenticateJWT,
  requireRole('school_admin'),
  requireSchool,
  express.raw({ type: LOGO_TYPES, limit: MAX_LOGO_BYTES }),
  async (req: AuthenticatedRequest, res) => {
    const type = req.headers['content-type']?.split(';')[0]?.trim() ?? '';
    if (!LOGO_TYPES.includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new HttpError(400, 'The logo must be a PNG, JPEG or WebP image', 'INVALID_LOGO');
    }
    const schoolId = schoolIdOf(req);
    await saveLogo(schoolId, req.body, type);
    res.json(await findBranding(schoolId));
  },
);

// DELETE /api/schools/branding/logo: back to the default mark
router.delete('/branding/logo', authenticateJWT, requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const schoolId = schoolIdOf(req);
  await saveLogo(schoolId, null, null);
  res.json(await findBranding(schoolId));
});

// GET /api/schools/:id/logo: public, since an <img> can't send the session token. A logo isn't secret, and the
// institution's id can't be guessed. The URL changes with every new logo, so it can be cached for good.
router.get('/:id/logo', async (req, res) => {
  const logo = await findLogo(readId(req.params.id, NO_LOGO));
  if (!logo) throw new HttpError(404, NO_LOGO);
  res
    .set({
      'Content-Type': logo.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    })
    .send(logo.logo);
});

export default router;
