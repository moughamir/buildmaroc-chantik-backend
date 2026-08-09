import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, bearer } from 'better-auth/plugins';
import { db } from './db';
import { users, sessions, accounts, organizations, organizationMembers } from './db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail, sendResetPassword } from './lib/email';

// Refuse to boot in production without a signing secret.
if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required when NODE_ENV=production');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema: { users, sessions, accounts, organizations, organizationMembers },
  }),
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.BASE_URL || 'http://localhost:8080',
  trustedOrigins: (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ||
    process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://localhost:8080'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPassword(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', input: false, required: false, defaultValue: 'user' },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
  },
  advanced: {
    // Custom fn instead of the 'uuid' string: with the pg adapter, supportsUUIDs
    // is true, so the 'uuid' string makes better-auth skip client-side id
    // generation and rely on a DB default — but users.id deliberately has NO
    // default (spec). A custom fn makes better-auth supply the uuid itself.
    database: { generateId: () => crypto.randomUUID() },
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'chantik',
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
    },
    trustedProxyHeaders: process.env.TRUST_PROXY === '1',
  },
  rateLimit: {
    // Memory storage — switch to storage:'database' when horizontally scaled.
    enabled: true,
    window: 10,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
    },
  },
  plugins: [
    organization({
      // NOTE: modelName must be the SINGULAR 'organizationMember' — with
      // usePlural: true, better-auth's getModelName appends 's' to a custom
      // modelName, so 'organizationMembers' would resolve to the non-existent
      // 'organizationMemberss'. 'organizationMember' → 'organizationMembers'. 
      schema: { member: { modelName: 'organizationMember' } },
      allowUserToCreateOrganization: async (user) => user.emailVerified === true,
      teams: { enabled: false },
    }),
    // Enables Authorization: Bearer <sessionToken> as an alternative to
    // cookies (used for API clients / Swagger UI testing). The session token
    // is returned by sign-in; auth.api.getSession resolves it automatically.
    bearer(),
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [m] = await db
            .select({ organizationId: organizationMembers.organizationId })
            .from(organizationMembers)
            .where(eq(organizationMembers.userId, session.userId))
            .limit(1);
          return { data: { ...session, activeOrganizationId: m?.organizationId ?? null } };
        },
      },
    },
  },
});
