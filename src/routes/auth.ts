import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { auth } from '../auth';
import { authSignInSchema, authSignInResponseSchema } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

// Mounted at /api/v1/auth.
// OpenAPI-documented sign-in so Swagger UI (and API clients) can obtain a
// session token, which is then used as `Authorization: Bearer <token>` on every
// authenticated route (better-auth bearer plugin). The raw better-auth
// endpoints (/api/auth/*) remain mounted for cookie-based frontends.
export const authApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const signInRoute = createRoute({
  method: 'post',
  path: '/sign-in',
  request: {
    body: { content: { 'application/json': { schema: authSignInSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Sign-in successful — returns the session token (use as Bearer)',
      content: { 'application/json': { schema: authSignInResponseSchema } },
    },
    400: { description: 'Validation error' },
    401: { description: 'Invalid email or password' },
  },
});

authApp.openapi(signInRoute, async (c) => {
  const { email, password } = c.req.valid('json');
  try {
    const res = await auth.api.signInEmail({ body: { email, password } });
    if (!res.token) return c.json({ error: 'Sign-in did not return a token' }, 500);
    return c.json({ token: res.token, user: res.user }, 200);
  } catch {
    return c.json({ error: 'Invalid email or password' }, 401);
  }
});
