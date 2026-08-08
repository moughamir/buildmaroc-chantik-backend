import type { Context, Env } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// ============================================================================
// L6c — Shared validation-failure shape for the converted OpenAPIHono apps.
//
// Every invalid body / param / query on the converted apps (projectsApp,
// notesApp, pointageApp) renders the same HTTP 400 shape:
//
//   { "error": { "message": "<concise first-issue message>", "issues": [...] } }
//
// replacing the zod-validator default `{ success: false, error: ZodError }`.
// Backward-compatible: both the admin console client and the frontend client
// throw on non-2xx and never parse the error body.
//
// Wire-up (per converted app):
//   new OpenAPIHono({ defaultHook: validationErrorHook }).onError(validationErrorHandler)
//
// - `validationErrorHook` is the OpenAPIHono `defaultHook`: it formats the
//   ZodError raised by the createRoute `request` schemas (body / params /
//   query — including the L6b `{id}` / `{projectId}` uuid params).
// - `validationErrorHandler` is the app-level `onError`: Hono's validator
//   throws HTTPException(400, "Malformed JSON in request body") for *malformed*
//   JSON bodies *before* any Zod schema runs, so the hook never sees it — this
//   handler renders it in the same shape. Non-400 HTTPExceptions keep the flat
//   `{ error: string }` convention; unknown errors stay 500 like the parent.
// ============================================================================

export interface ValidationIssue {
  path: Array<string | number>;
  message: string;
  code: string;
}

export interface ValidationErrorBody {
  message: string;
  issues?: ValidationIssue[];
}

function formatZodError(error: ZodError): ValidationErrorBody {
  const issues: ValidationIssue[] = error.issues.map((issue) => ({
    path: issue.path as Array<string | number>,
    message: issue.message,
    code: String(issue.code),
  }));
  const first = error.issues[0];
  const pathLabel = first && first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return {
    message: first ? `${pathLabel}${first.message}` : 'Validation failed',
    issues,
  };
}

export const validationErrorHook = <E extends Env = Env>(
  result: { success: boolean; error?: unknown; target?: string },
  c: Context<E>,
): Response | undefined => {
  if (result.success) return undefined;
  const body =
    result.error instanceof ZodError
      ? formatZodError(result.error)
      : { message: 'Validation failed' };
  return c.json({ error: body }, 400);
};

export const validationErrorHandler = <E extends Env = Env>(
  err: Error,
  c: Context<E>,
): Response => {
  if (err instanceof HTTPException) {
    if (err.status === 400) {
      // Malformed JSON body (Hono validator) — same nested shape as Zod failures.
      return c.json({ error: { message: err.message, issues: [] } }, 400);
    }
    // Non-400 HTTP exceptions keep the flat { error: string } convention.
    return c.json({ error: err.message }, err.status);
  }
  console.error(`Unhandled error: ${err}`);
  return c.json({ error: 'Internal server error' }, 500);
};
