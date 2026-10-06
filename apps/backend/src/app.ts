import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { apiLimiter, clientErrorLimiter, emailLimiter, loginLimiter } from './http/rateLimit.js';
import { requestLogger } from './http/requestLog.js';
import authRoutes from './modules/auth/auth.routes.js';
import classRoutes from './modules/classes/classes.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import eventRoutes from './modules/events/events.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import invitationRoutes from './modules/invitations/invitations.routes.js';
import monitoringRoutes from './modules/monitoring/monitoring.routes.js';
import brandingRoutes from './modules/schools/branding.routes.js';
import schoolRoutes from './modules/schools/schools.routes.js';
import attendanceRoutes from './modules/sessions/attendance.routes.js';
import clientRoutes from './modules/sessions/clients.routes.js';
import reportRoutes from './modules/sessions/reports.routes.js';
import therapyRoutes from './modules/therapies/therapies.routes.js';
import timelineRoutes from './modules/timetable/timeline.routes.js';
import timetableRoutes from './modules/timetable/timetable.routes.js';
import meRoutes from './modules/users/me.routes.js';
import userRoutes from './modules/users/users.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // First, so it times the whole request
  app.use(requestLogger);
  // Behind a reverse proxy every request seems to come from the proxy; this reads the real client IP
  if (env.trustProxy !== undefined) app.set('trust proxy', env.trustProxy);
  // The API only serves JSON, so nothing should ever be framed, sniffed or sent a referrer
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    });
    if (env.nodeEnv === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/resend-verification', emailLimiter);
  // Accepting an invitation for an existing account checks its password, like signing in
  app.use('/api/invitations/accept', loginLimiter);
  app.use('/api/monitoring/client-errors', clientErrorLimiter);

  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/invitations', invitationRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/schools', brandingRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/therapies', therapyRoutes);
  app.use('/api/timeline', timelineRoutes);
  app.use('/api/timetable', timetableRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/health', healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
