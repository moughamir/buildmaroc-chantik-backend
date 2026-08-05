import { Hono } from 'hono';
import { cors } from 'hono/cors';
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

const app = new Hono();

app.use('*', cors());
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

export default {
  port: process.env.PORT || 8080,
  fetch: app.fetch,
};