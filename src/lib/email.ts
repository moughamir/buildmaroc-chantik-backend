// Email dispatch for better-auth (verification + password reset).
//
// Provider is selected with EMAIL_PROVIDER:
//   - "console" (default): log the email to stdout (dev)
//   - "smtp": send via nodemailer using SMTP_URL (smtp:// URL) + SMTP_FROM
//
// Both exported helpers are fire-and-forget: they never throw to the caller
// (better-auth awaits them during sign-up / email verification / password
// reset), and the smtp path catches transport errors and logs them.

// nodemailer is typed `any` via src/lib/nodemailer.d.ts (ambient shorthand).

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();

function subjectFor(kind: 'verification' | 'reset-password'): string {
  return kind === 'verification'
    ? 'Chantik — vérifiez votre adresse e-mail'
    : 'Chantik — réinitialisation de votre mot de passe';
}

/** Minimal HTML-escaping so user-controlled values never break the markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendViaConsole(
  userEmail: string,
  kind: 'verification' | 'reset-password',
  url: string,
): Promise<void> {
  // The console path must never throw.
  try {
    console.log(`[chantik-email] to=<${userEmail}> ${kind}: ${url}`);
  } catch (err) {
    console.error('[chantik-email] console log failed:', err);
  }
}

async function sendViaSmtp(
  userEmail: string,
  kind: 'verification' | 'reset-password',
  url: string,
): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.SMTP_FROM;
  if (!smtpUrl || !from) {
    console.warn(
      '[chantik-email] EMAIL_PROVIDER=smtp but SMTP_URL/SMTP_FROM not set — skipping send',
    );
    return;
  }
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport(smtpUrl);
  const subject = subjectFor(kind);
  const text = `${subject}\n\n${url}`;
  const html = [
    '<!doctype html><html><body>',
    `<p>${escapeHtml(subject)}</p>`,
    `<p>Suivez ce lien : <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    '</body></html>',
  ].join('');
  await transporter.sendMail({ from, to: userEmail, subject, text, html });
}

export async function sendVerificationEmail(
  userEmail: string,
  url: string,
): Promise<void> {
  try {
    if (EMAIL_PROVIDER === 'smtp') {
      await sendViaSmtp(userEmail, 'verification', url);
    } else {
      await sendViaConsole(userEmail, 'verification', url);
    }
  } catch (err) {
    console.error(
      `[chantik-email] failed to send verification email to <${userEmail}>:`,
      err,
    );
  }
}

export async function sendResetPassword(
  userEmail: string,
  url: string,
): Promise<void> {
  try {
    if (EMAIL_PROVIDER === 'smtp') {
      await sendViaSmtp(userEmail, 'reset-password', url);
    } else {
      await sendViaConsole(userEmail, 'reset-password', url);
    }
  } catch (err) {
    console.error(
      `[chantik-email] failed to send reset-password email to <${userEmail}>:`,
      err,
    );
  }
}
