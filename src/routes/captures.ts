import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { uploadUrlSchema, uploadUrlResponseSchema } from '../validation/schemas';
import type { UploadUrlInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';
import type { SessionVariables } from '../middleware/session';
import { requireOrgMembership } from '../middleware/tenant';

let supabase: ReturnType<typeof import("@supabase/supabase-js").createClient> | null = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (url && key) {
    supabase = createClient(url, key);
  }
} catch {
  // Supabase not configured
}

// Mounted at /api/v1/captures.
export const capturesApp = new OpenAPIHono<{ Variables: SessionVariables }>({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const uploadUrlRoute = createRoute({
  method: 'post',
  path: '/upload-url',
  tags: ['captures'],
  request: {
    body: { content: { 'application/json': { schema: uploadUrlSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Signed upload URL for a panorama asset',
      content: { 'application/json': { schema: uploadUrlResponseSchema } },
    },
    400: { description: 'Supabase storage error' },
    401: { description: 'Authentication required' },
    403: { description: 'Forbidden' },
    500: { description: 'Storage not configured' },
  },
});

capturesApp.openapi(uploadUrlRoute, async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Authentication required' }, 401);
  const denied = await requireOrgMembership(c, orgId);
  if (denied) return denied;

  const { fileName, fileType } = c.req.valid('json') as UploadUrlInput;
  if (!supabase) return c.json({ error: 'Storage not configured' }, 500);
  const path = `organizations/${orgId}/panoramas/${Date.now()}_${fileName}`;

  const { data, error } = await supabase.storage
    .from('chantik-assets')
    .createSignedUploadUrl(path);

  if (error) return c.json({ error: error.message }, 400);

  return c.json({ uploadUrl: data.signedUrl, path });
});
