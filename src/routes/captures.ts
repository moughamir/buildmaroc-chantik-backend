import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { uploadUrlSchema, uploadUrlResponseSchema } from '../validation/schemas';
import type { UploadUrlInput } from '../validation/schemas';
import { validationErrorHook, validationErrorHandler } from '../validation/error-handlers';

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
// L6e: OpenAPIHono + createRoute pattern with the shared 400 validation shape.
// The signed-upload-url response shape is kept byte-identical.
export const capturesApp = new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler);

const uploadUrlRoute = createRoute({
  method: 'post',
  path: '/upload-url',
  request: {
    body: { content: { 'application/json': { schema: uploadUrlSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Signed upload URL for a panorama asset',
      content: { 'application/json': { schema: uploadUrlResponseSchema } },
    },
    400: {
      description: 'Supabase storage error',
    },
    500: {
      description: 'Storage not configured',
    },
  },
});

capturesApp.openapi(uploadUrlRoute, async (c) => {
  const { fileName, fileType } = c.req.valid('json') as UploadUrlInput;
  if (!supabase) return c.json({ error: 'Storage not configured' }, 500);
  const path = `panoramas/${Date.now()}_${fileName}`;

  const { data, error } = await supabase.storage
    .from('chantik-assets')
    .createSignedUploadUrl(path);

  if (error) return c.json({ error: error.message }, 400);

  return c.json({ uploadUrl: data.signedUrl, path });
});
