import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import dashboardRoutes from './routes/dashboards.js';
import classRoutes from './routes/classes.js';
import courseRoutes from './routes/courses.js';
import timelineRoutes from './routes/timeline.js';
import eventRoutes from './routes/events.js';
import timetableRoutes from './routes/timetable.js';
import userRoutes from './routes/users.js';
import schoolRoutes from './routes/schools.js';
import invitationRoutes from './routes/invitations.js';
import monitoringRoutes from './routes/monitoring.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { requestLogger } from './middleware/requestLog.js';
import { pruneLogs } from './utils/logs.js';
import { apiLimiter, clientErrorLimiter, emailLimiter, loginLimiter, registerLimiter } from './middleware/rateLimit.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.disable('x-powered-by');
// First, so it times the whole request
app.use(requestLogger);
// Behind a reverse proxy (nginx, a load balancer) every request seems to come from the proxy.
// TRUST_PROXY=1 tells Express to read the real client IP from the proxy's X-Forwarded-For header.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/resend-verification', emailLimiter);
// Accepting an invitation for an existing account checks its password, so treat it like signing in
app.use('/api/invitations/accept', loginLimiter);
app.use('/api/monitoring/client-errors', clientErrorLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// Old log entries are cleared at start-up and every six hours; unref() lets the process exit without waiting
void pruneLogs();
setInterval(() => void pruneLogs(), 6 * 60 * 60 * 1000).unref();
