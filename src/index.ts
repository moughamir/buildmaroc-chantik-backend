import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { join } from 'node:path';
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
import { constructionRootApp } from './routes/construction-root';
import { notesApp } from './routes/notes';
import { pointageApp } from './routes/pointage';
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

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('*', cors({
  origin: ['http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));

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
  .route('/api/v1/sync', syncApp)
  .route('/api/v1/captures', capturesApp)
  .route('/api/v1/organizations', organizationsApp)
  .route('/api/v1/users', usersApp)
  .route('/api/v1/projects', projectsApp)
  .route('/api/v1/invitations', invitationsRouter)
  .route('/api/v1/crews', crewsApp)
  .route('/api/v1', spatialApp)
  .route('/api/v1', attendanceApp)
  .route('/api/v1', constructionRootApp)
  .route('/api/v1', pointageApp)
  .route('/api/v1/projects/:projectId/notes', notesApp)
  .route('/api/v1/admin', adminApp);

// OpenAPI document + Swagger UI (L6b). Reassign so AppType also carries the
// doc route; must stay after all sub-app mounts so the doc covers every path.
app = app.doc('/api/v1/doc', {
  openapi: '3.0.0',
  info: { title: 'CHANTIK API', version: '1.0.0' },
});
app.get('/api/v1/docs', swaggerUI({ url: '/api/v1/doc' }));

// App type for the future typed RPC client (hc<AppType>).
export type AppType = typeof app;

const adminFrontendDir = process.env.ADMIN_FRONTEND_DIR || join(process.cwd(), '..', 'admin-frontend', 'dist');

app.use('/admin/*', async (c) => {
  const url = new URL(c.req.url);
  const subPath = url.pathname.replace(/^\/admin/, '') || '/index.html';
  const filePath = join(adminFrontendDir, subPath === '/' ? 'index.html' : subPath);
  const exists = await Bun.file(filePath).exists();
  if (exists) {
    const file = Bun.file(filePath);
    return new Response(file, { headers: { 'Content-Type': getContentType(filePath) } });
  }
  const indexFile = join(adminFrontendDir, 'index.html');
  if (await Bun.file(indexFile).exists()) {
    return new Response(Bun.file(indexFile), { headers: { 'Content-Type': 'text/html' } });
  }
  return c.text('Admin frontend not found', 404);
});

// Client SPA: serves the BUILT output (dist). The source tree is TSX/TS and
// can't be served raw — since the React migration (v2.0.0), FRONTEND_DIR must
// point at `frontend/dist` for single-server serving. Dev: use Vite on 5173.
const frontendDir = process.env.FRONTEND_DIR || join(process.cwd(), '..', 'frontend', 'dist');

// Garde-fou Personas : le mode développeur est piloté côté serveur.
// Le contenu de la balise <meta name="chantik-dev-mode"> est injecté depuis
// NODE_ENV à chaque service d'index.html ("true" hors production, "false" en
// production). Seul l'attribut `content` est réécrit — le reste du HTML est
// conservé à l'identique. Le frontend ne lit plus aucun paramètre d'URL.
const DEV_MODE_META_PATTERN = /(<meta\s+name="chantik-dev-mode"\s+content=")[^"]*(")/;

async function serveSpaIndex() {
  const indexFile = join(frontendDir, 'index.html');
  if (!(await Bun.file(indexFile).exists())) return null;
  const devModeContent = (process.env.NODE_ENV !== 'production').toString();
  const html = (await Bun.file(indexFile).text()).replace(
    DEV_MODE_META_PATTERN,
    `$1${devModeContent}$2`,
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/')) {
    await next();
    return;
  }

  // index.html (racine ou explicite) : toujours servi avec le drapeau injecté
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const spaIndex = await serveSpaIndex();
    if (spaIndex) return spaIndex;
    await next();
    return;
  }

  const filePath = join(frontendDir, url.pathname);
  const exists = await Bun.file(filePath).exists();
  if (exists) {
    const file = Bun.file(filePath);
    const contentType = getContentType(url.pathname);
    return new Response(file, { headers: { 'Content-Type': contentType } });
  }

  // Fallback SPA (routes profondes) : index.html injecté
  const spaIndex = await serveSpaIndex();
  if (spaIndex) return spaIndex;
  await next();
});

function getContentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

export default {
  port: process.env.PORT || 8080,
  fetch: app.fetch,
};