import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join } from 'node:path';
import { authMiddleware } from './middleware/auth';
import { syncRouter } from './routes/sync';
import { capturesRouter } from './routes/captures';
import { organizationsRouter } from './routes/organizations';
import { usersRouter } from './routes/users';
import { projectsRouter } from './routes/projects';
import { invitationsRouter } from './routes/invitations';
import { crewsRouter } from './routes/crews';
import { spatialRouter } from './routes/spatial';
import { attendanceRouter } from './routes/attendance';
import { constructionRootRouter } from './routes/construction-root';
import { notesRouter } from './routes/notes';
import { pointageRouter } from './routes/pointage';

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));
app.use('*', authMiddleware);

app.onError((err, c) => {
  console.error(`Unhandled error: ${err}`);
  return c.json({ error: 'Internal server error' }, 500);
});

app.route('/api/v1/sync', syncRouter);
app.route('/api/v1/captures', capturesRouter);
app.route('/api/v1/organizations', organizationsRouter);
app.route('/api/v1/users', usersRouter);
app.route('/api/v1/projects', projectsRouter);
app.route('/api/v1/invitations', invitationsRouter);
app.route('/api/v1/crews', crewsRouter);
app.route('/api/v1', spatialRouter);
app.route('/api/v1', attendanceRouter);
app.route('/api/v1', constructionRootRouter);
app.route('/api/v1', pointageRouter);
app.route('/api/v1/projects/:projectId/notes', notesRouter);

const frontendDir = process.env.FRONTEND_DIR || join(process.cwd(), '..', 'frontend');

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/')) {
    await next();
    return;
  }
  const filePath = join(frontendDir, url.pathname === '/' ? 'index.html' : url.pathname);
  const exists = await Bun.file(filePath).exists();
  if (exists) {
    const file = Bun.file(filePath);
    const contentType = getContentType(url.pathname);
    return new Response(file, { headers: { 'Content-Type': contentType } });
  }
  const indexFile = join(frontendDir, 'index.html');
  if (await Bun.file(indexFile).exists()) {
    return new Response(Bun.file(indexFile), { headers: { 'Content-Type': 'text/html' } });
  }
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