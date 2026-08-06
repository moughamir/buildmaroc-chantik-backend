import { Hono } from "hono";
import { validateUploadUrl } from '../validation/middleware';
import type { UploadUrlInput } from '../validation/schemas';

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

export const capturesRouter = new Hono();

capturesRouter.post('/upload-url', validateUploadUrl, async (c) => {
  const { fileName, fileType } = c.req.valid('json') as UploadUrlInput;
  if (!supabase) return c.json({ error: 'Storage not configured' }, 500);
  const path = `panoramas/${Date.now()}_${fileName}`;

  const { data, error } = await supabase.storage
    .from('chantik-assets')
    .createSignedUploadUrl(path);

  if (error) return c.json({ error: error.message }, 400);

  return c.json({ uploadUrl: data.signedUrl, path });
});