import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { db } from './db';
import { users, sessions, accounts, organizations, organizationMembers } from './db/schema';
import { eq } from 'drizzle-orm';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema: { users, sessions, accounts, organizations, organizationMembers },
  }),
  baseURL: process.env.BASE_URL || 'http://localhost:8080',
  trustedOrigins: ['http://localhost:8080', 'http://localhost:5173'],
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      role: { type: 'string', input: false, required: false, defaultValue: 'user' },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7 },
  advanced: {
    // Custom fn instead of the 'uuid' string: with the pg adapter, supportsUUIDs
    // is true, so the 'uuid' string makes better-auth skip client-side id
    // generation and rely on a DB default — but users.id deliberately has NO
    // default (spec). A custom fn makes better-auth supply the uuid itself.
    database: { generateId: () => crypto.randomUUID() },
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'chantik',
  },
  plugins: [
    organization({
      // NOTE: modelName must be the SINGULAR 'organizationMember' — with
      // usePlural: true, better-auth's getModelName appends 's' to a custom
      // modelName, so 'organizationMembers' would resolve to the non-existent
      // 'organizationMemberss'. 'organizationMember' → 'organizationMembers'. 
      schema: { member: { modelName: 'organizationMember' } },
      allowUserToCreateOrganization: true,
      teams: { enabled: false },
    }),
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
