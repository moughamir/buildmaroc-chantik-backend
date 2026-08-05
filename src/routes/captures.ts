import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { validateUploadUrl } from '../validation/middleware';
import type { UploadUrlInput } from '../validation/schemas';

export const capturesRouter = new Hono()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

capturesRouter.post('/upload-url', validateUploadUrl, async (c) => {
  const { fileName, fileType } = c.req.valid('json') as UploadUrlInput;
  const path = `panoramas/${Date.now()}_${fileName}`;

  const { data, error } = await supabase.storage
    .from('chantik-assets')
    .createSignedUploadUrl(path);

  if (error) return c.json({ error: error.message }, 400);

  return c.json({ uploadUrl: data.signedUrl, path });
});