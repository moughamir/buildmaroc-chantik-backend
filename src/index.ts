import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { auth } from './auth';
import { sessionMiddleware, type SessionVariables } from './middleware/session';
import { adminGuard } from './middleware/admin';
import { syncApp } from './routes/sync';
import { capturesApp } from './routes/captures';
import { organizationsApp } from './routes/organizations';
import { usersApp } from './routes/users';
import { projectsApp } from './routes/projects';
import { invitationsRouter } from './routes/invitations';
import { crewsApp } from './routes/crews';
import { spatialApp } from './routes/spatial';
import { attendanceApp } from './routes/attendance';
import { constructionApp } from './routes/construction';
import { equipmentApp } from './routes/equipment';
import { notesApp } from './routes/notes';
import { pointageApp } from './routes/pointage';
import { authApp } from './routes/auth';
import { adminApp } from './routes/admin';

let app = new OpenAPIHono<{ Variables: SessionVariables }>();

app.use('*', async (c, next) => {
  const correlationId = c.req.header('x-correlation-id') || crypto.randomUUID();
  c.header('x-correlation-id', correlationId);
  const start = performance.now();
  await next();
  const duration = Math.round(performance.now() - start);
  if (c.req.path.startsWith('/api/')) {
    console.log(`[${correlationId}] ${c.req.method} ${c.req.path} -> ${c.res.status} (${duration}ms)`);
  }
});

// Agnostic API: allowed origins are configured by the UI hosts (never assumed).
// Comma-separated list, e.g. CORS_ORIGINS=https://app.example.com,https://admin.example.com
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// NOTE: Hono `use` middleware applies only to routes registered AFTER it —
// the health routes below are intentionally registered after this cors mount.
app.use('*', cors({
  origin: corsOrigins,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// better-auth handlers (email/password + organization plugin) — BEFORE session middleware.
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// Session resolution for the API (replaces the Supabase authMiddleware).
app.use('/api/*', sessionMiddleware);

app.onError((err, c) => {
  console.error(`Unhandled error: ${err}`);
  return c.json({ error: 'Internal server error' }, 500);
});

// L6e: chained reassignment so `AppType` accumulates the route types of every
// converted sub-app (same runtime instance — route() returns `this`).
app.use('/api/v1/admin/*', adminGuard);
app = app
  .route('/api/v1/auth', authApp)
  .route('/api/v1/sync', syncApp)
  .route('/api/v1/captures', capturesApp)
  .route('/api/v1/organizations', organizationsApp)
  .route('/api/v1/users', usersApp)
  .route('/api/v1/projects', projectsApp)
  .route('/api/v1/invitations', invitationsRouter)
  .route('/api/v1/crews', crewsApp)
  .route('/api/v1/spatial', spatialApp)
  .route('/api/v1', attendanceApp)
  .route('/api/v1/construction', constructionApp)
  .route('/api/v1/equipment', equipmentApp)
  .route('/api/v1', pointageApp)
  .route('/api/v1/projects/:projectId/notes', notesApp)
  .route('/api/v1/admin', adminApp);

// OpenAPI document + Swagger UI (L6b). Reassign so AppType also carries the
// doc route; must stay after all sub-app mounts so the doc covers every path.
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description:
    'Session token. Get one via POST /api/v1/auth/sign-in (or any better-auth sign-in), then paste it here. ' +
    'In local dev (AUTH_DEV_BYPASS=1 only) you can also impersonate a user with the `x-user-id` header (see session middleware).',
});
app = app.doc('/api/v1/doc', {
  openapi: '3.0.0',
  info: { title: 'CHANTIK API', version: '1.0.0' },
  security: [{ bearerAuth: [] }],
});
app.get('/api/v1/docs', swaggerUI({ url: '/api/v1/doc', persistAuthorization: true }));

// App type for the future typed RPC client (hc<AppType>).
export type AppType = typeof app;

export default {
  port: process.env.PORT || 8080,
  fetch: app.fetch,
};