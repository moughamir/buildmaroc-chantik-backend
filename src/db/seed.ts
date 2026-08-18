import { db, client } from './index';
import { eq, and } from 'drizzle-orm';
import { auth } from '../auth';
import { fakerFR as faker } from '@faker-js/faker';
import {
  users,
  userPreferences,
  userSecurityLogs,
  organizations,
  organizationMembers,
  organizationInvitations,
  teams,
  teamMembers,
  customRoles,
  rolePermissions,
  userRoles,
  subscriptions,
  invoices,
  apiKeys,
  webhooks,
  projects,
  projectMembers,
  zones,
  capturePoints,
  panoramas,
  hotspots,
  auditLogs,
  workCrews,
  crewMembers,
  attendanceLogs,
  siteDailyLogs,
  rfis,
  changeOrders,
  equipment,
  blueprintSheets,
  notes,
  tradeCatalog,
  subcontractors,
  pointageRecords,
} from './schema';
// @ts-ignore
import { INITIAL_CHANTIERS } from '../../../frontend/src/data/mockChantiers.js';
// @ts-ignore
import { INITIAL_COMPANY_TRADES, INITIAL_SUBCONTRACTORS } from '../../../frontend/src/data/pointageMockData.js';

function generateId(): string {
  return crypto.randomUUID();
}

async function seed() {
  console.log('🌱 Starting comprehensive Faker-powered database seed...');

  // --- Idempotent Cleanup in Reverse Foreign Key Order ---
  await db.delete(pointageRecords);
  await db.delete(subcontractors);
  await db.delete(tradeCatalog);
  await db.delete(notes);
  await db.delete(blueprintSheets);
  await db.delete(equipment);
  await db.delete(changeOrders);
  await db.delete(rfis);
  await db.delete(siteDailyLogs);
  await db.delete(attendanceLogs);
  await db.delete(crewMembers);
  await db.delete(workCrews);
  await db.delete(auditLogs);
  await db.delete(hotspots);
  await db.delete(panoramas);
  await db.delete(capturePoints);
  await db.delete(zones);
  await db.delete(projectMembers);
  await db.delete(projects);
  await db.delete(webhooks);
  await db.delete(apiKeys);
  await db.delete(invoices);
  await db.delete(subscriptions);
  await db.delete(organizationInvitations);
  await db.delete(teamMembers);
  await db.delete(teams);
  await db.delete(userRoles);
  await db.delete(rolePermissions);
  await db.delete(customRoles);
  await db.delete(organizationMembers);
  await db.delete(organizations);
  await db.delete(userSecurityLogs);
  await db.delete(userPreferences);
  await db.delete(users);
  console.log('  🧹 Cleaned all existing tables');

  // --- 1. Users & Preferences & Security Logs ---
  const userIds: string[] = [];
  const orgCount = 3;
  const usersPerOrg = 4;

  for (let i = 0; i < orgCount * usersPerOrg; i++) {
    const userId = generateId();
    userIds.push(userId);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    await db.insert(users).values({
      id: userId,
      email,
      name: `${firstName} ${lastName}`,
      image: faker.image.avatar(),
      role: i === 0 ? 'super-admin' : 'user',
    } as any);

    await db.insert(userPreferences).values({
      userId,
      theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
      locale: 'fr-FR',
      timezone: 'Africa/Casablanca',
      offlineModeDefault: true,
    } as any);

    await db.insert(userSecurityLogs).values({
      id: generateId(),
      userId,
      event: 'LOGIN_SUCCESS',
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
    } as any);
  }
  console.log(`  ✅ Seeded ${userIds.length} users with preferences & security logs`);

  // --- 2. Organizations, Subscriptions, Invoices, API Keys, Webhooks ---
  const orgIds: string[] = [];
  const orgPlans = ['enterprise', 'pro', 'starter'] as const;

  for (let i = 0; i < orgCount; i++) {
    const orgId = generateId();
    orgIds.push(orgId);
    const companyName = faker.company.name() + ' BTP';
    const slug = faker.helpers.slugify(companyName).toLowerCase() + '-' + i;
    const billingEmail = faker.internet.email();

    await db.insert(organizations).values({
      id: orgId,
      name: companyName,
      slug,
      billingEmail,
    } as any);

    // Subscription
    await db.insert(subscriptions).values({
      id: generateId(),
      organizationId: orgId,
      plan: orgPlans[i],
      status: 'active',
      maxProjects: i === 0 ? 50 : i === 1 ? 15 : 5,
      currentPeriodEnd: faker.date.future(),
    } as any);

    // Invoices
    await db.insert(invoices).values({
      id: generateId(),
      organizationId: orgId,
      externalId: `inv_${faker.string.alphanumeric(8)}`,
      amountDue: i === 0 ? 99900 : i === 1 ? 49900 : 19900,
      amountPaid: i === 0 ? 99900 : i === 1 ? 49900 : 19900,
      status: 'paid',
      hostedInvoiceUrl: faker.internet.url(),
    } as any);

    // API Keys
    await db.insert(apiKeys).values({
      id: generateId(),
      organizationId: orgId,
      name: 'Production Key',
      keyHash: faker.string.alphanumeric(64),
      prefix: 'chk_',
    } as any);

    // Webhooks
    await db.insert(webhooks).values({
      id: generateId(),
      organizationId: orgId,
      endpointUrl: faker.internet.url(),
      secret: faker.string.alphanumeric(32),
      isActive: true,
      events: ['project.created', 'hotspot.resolved'],
    } as any);
  }
  console.log('  ✅ Seeded organizations, subscriptions, invoices, API keys, and webhooks');

  // --- 3. Tenant Users Link, Teams & Members ---
  for (let orgIdx = 0; orgIdx < orgIds.length; orgIdx++) {
    const orgId = orgIds[orgIdx];
    const orgUsers = userIds.slice(orgIdx * usersPerOrg, (orgIdx + 1) * usersPerOrg);

    for (let uIdx = 0; uIdx < orgUsers.length; uIdx++) {
      const userId = orgUsers[uIdx];
      const role = uIdx === 0 ? 'owner' : uIdx === 1 ? 'admin' : 'member';

      await db.insert(organizationMembers).values({
        organizationId: orgId,
        userId,
        role,
      } as any);
    }

    // Teams
    const teamId = generateId();
    await db.insert(teams).values({
      id: teamId,
      organizationId: orgId,
      name: `Équipe Terrain ${faker.location.city()}`,
    } as any);

    await db.insert(teamMembers).values({
      teamId,
      userId: orgUsers[1],
    } as any);

    // Invitations
    await db.insert(organizationInvitations).values({
      id: generateId(),
      organizationId: orgId,
      email: faker.internet.email(),
      role: 'member',
      token: faker.string.alphanumeric(16),
      status: 'pending',
      invitedById: orgUsers[0],
      expiresAt: faker.date.future(),
    } as any);
  }
  console.log('  ✅ Linked tenants with users, teams, and invitations');

  // --- 4. Custom Roles & Permissions ---
  const primaryOrgId = orgIds[0];
  const adminUserId = userIds[0];
  const customRoleId = generateId();

  await db.insert(customRoles).values({
    id: customRoleId,
    organizationId: primaryOrgId,
    name: 'SaaS Platform Superadmin',
    isSystem: true,
  } as any);

  const resources = ['project', 'billing', 'team', 'member', 'webhook', 'api_key'] as const;
  for (const resource of resources) {
    await db.insert(rolePermissions).values({
      roleId: customRoleId,
      resource,
      action: 'manage',
    } as any);
  }

  await db.insert(userRoles).values({
    userId: adminUserId,
    roleId: customRoleId,
    organizationId: primaryOrgId,
  } as any);
  console.log('  ✅ Seeded RBAC custom roles and permissions');

  // --- DEV credential user (AUTH_DEV_BYPASS=1 only; never in production) ---
  // Lets a human log in with email/password via better-auth during local
  // development. The org membership row is inserted so /api/v1/projects and
  // org-scoped routes resolve a default org for this user.
  if (process.env.AUTH_DEV_BYPASS === '1' && process.env.NODE_ENV !== 'production') {
    try {
      const devEmail = 'admin@chantik.dev';
      const devPassword = process.env.DEV_SEED_PASSWORD || 'chantik-dev-2026!';

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, devEmail)).limit(1);
      let devUserId = existing?.id;
      if (!devUserId) {
        const signedUp = await auth.api.signUpEmail({
          body: { email: devEmail, password: devPassword, name: 'Admin Chantik' },
        });
        devUserId = signedUp.user.id;
      }

      await db.update(users).set({ role: 'super-admin' }).where(eq(users.id, devUserId));

      const [existingMember] = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, devUserId),
          eq(organizationMembers.organizationId, primaryOrgId),
        ))
        .limit(1);
      if (!existingMember) {
        await db.insert(organizationMembers).values({
          organizationId: primaryOrgId,
          userId: devUserId,
          role: 'owner',
        });
      }
      console.log(`  ✅ Seeded dev credential user ${devEmail} (password: ${devPassword})`);
    } catch (err) {
      console.error('  ⚠️ Dev credential seed skipped:', err);
    }
  }

  // --- 5. Trade Catalog ---
  // Track inserted IDs so pointage records can reference them by trade name.
  const tradeRows: { id: string; name: string }[] = [];
  for (const trade of INITIAL_COMPANY_TRADES) {
    const tradeId = generateId();
    await db.insert(tradeCatalog).values({
      id: tradeId,
      name: trade.name,
      category: trade.category || 'Métiers',
      icon: trade.icon || null,
      description: trade.notes || null,
    } as any);
    tradeRows.push({ id: tradeId, name: trade.name });
  }
  const tradeIdByName = new Map(tradeRows.map((t) => [t.name, t.id]));
  console.log(`  ✅ Seeded trade catalog (${INITIAL_COMPANY_TRADES.length} trades)`);

  // --- 6. Projects, Zones, Panoramas, Hotspots, Equipment, RFIs, COs, Crews, Attendance, Audit Logs ---
  for (let orgIdx = 0; orgIdx < orgIds.length; orgIdx++) {
    const orgId = orgIds[orgIdx];
    const orgUsers = userIds.slice(orgIdx * usersPerOrg, (orgIdx + 1) * usersPerOrg);
    const primaryManagerId = orgUsers[0];

    const chantiersToSeed = INITIAL_CHANTIERS.slice(0, 1);

    for (const chantier of chantiersToSeed) {
      const projectId = generateId();
      const startDate = parseFrenchDate(chantier.startDate);
      const expectedEndDate = parseFrenchDate(chantier.expectedEndDate);

      await db.insert(projects).values({
        id: projectId,
        organizationId: orgId,
        name: chantier.name,
        code: `${faker.string.alpha(3).toUpperCase()}-${faker.string.numeric(3)}`,
        region: chantier.location,
        coordinates: { lng: chantier.lng, lat: chantier.lat },
        status: mapOperationalStatusToLifecycle(chantier.status),
        operationalStatus: chantier.status,
        managerUserId: primaryManagerId,
        budgetCents: parseBudget(chantier.budget) ?? 10000000,
        spentProgress: chantier.spentProgress,
        surfaceSqm: parseSurface(chantier.surface) ?? 2000,
        workersCount: chantier.workersCount,
        complianceScore: parseComplianceScore(chantier.complianceScore) ?? 95,
        scheduleDeltaDays: parseScheduleDelta(chantier.scheduleAhead) ?? 0,
        startDate: startDate ?? new Date(),
        expectedEndDate: expectedEndDate ?? new Date(),
      } as any);

      // Project Members
      await db.insert(projectMembers).values({
        projectId,
        userId: primaryManagerId,
        projectRole: 'project_manager',
      } as any);

      // Equipment
      await db.insert(equipment).values({
        id: generateId(),
        organizationId: orgId,
        currentProjectId: projectId,
        name: `Grue ${faker.word.sample()}`,
        serialNumber: faker.string.alphanumeric(10),
        category: 'Lifting',
        status: 'in_use',
      } as any);

      // Blueprint Sheets
      await db.insert(blueprintSheets).values({
        id: generateId(),
        projectId,
        sheetNumber: 'A-101',
        title: 'Plan Architectonique R+4',
        version: 1,
        storagePath: `blueprints/${projectId}/A-101.pdf`,
        uploadedById: primaryManagerId,
      } as any);

      // RFIs & Change Orders
      await db.insert(rfis).values({
        id: generateId(),
        projectId,
        rfiNumber: 1,
        title: 'Validation fondations radier',
        question: 'Validation du dosage béton B35 par le bureau de contrôle.',
        status: 'answered',
        createdById: primaryManagerId,
      } as any);

      await db.insert(changeOrders).values({
        id: generateId(),
        projectId,
        coNumber: 'CO-01',
        title: 'Ajout niveau sous-sol supplémentaire',
        description: 'Demande client suite étude géotechnique.',
        costImpactCents: 2500000,
        scheduleImpactDays: 14,
        status: 'approved',
        requestedById: primaryManagerId,
      } as any);

      // Subcontractors
      const subs = INITIAL_SUBCONTRACTORS;
      const subRows: { id: string; company: string }[] = [];
      for (const sub of subs) {
        const subId = generateId();
        await db.insert(subcontractors).values({
          id: subId,
          projectId,
          company: sub.company,
          specialty: sub.specialty || sub.trade || 'Général',
        } as any);
        subRows.push({ id: subId, company: sub.company });
      }

      // Zones & Captures
      for (const capture of chantier.captures ?? []) {
        for (const zone of capture.zones ?? []) {
          const zoneId = generateId();
          await db.insert(zones).values({
            id: zoneId,
            projectId,
            name: zone.name,
            level: zone.type,
          } as any);

          const cpId = generateId();
          await db.insert(capturePoints).values({
            id: cpId,
            zoneId,
            title: `${capture.week} - ${zone.name}`,
          } as any);

          const panoramaId = generateId();
          await db.insert(panoramas).values({
            id: panoramaId,
            capturePointId: cpId,
            storagePath: `panoramas/${chantier.code}/${capture.id}/${zone.id}.jpg`,
            capturedAt: parseFrenchDate(capture.date) ?? new Date(),
            uploadedById: primaryManagerId,
            metadata: {
              week: capture.week,
              progress: capture.progress,
              operator: capture.operator,
              note: capture.note,
            },
          } as any);

          for (const hotspot of capture.hotspots ?? []) {
            await db.insert(hotspots).values({
              id: generateId(),
              panoramaId,
              pitch: hotspot.pitch,
              yaw: hotspot.yaw,
              title: hotspot.title,
              description: hotspot.text,
              status: 'pending',
            } as any);
          }
        }
      }

      // Work Crews & Attendance Logs & Daily Logs
      const crewId = generateId();
      await db.insert(workCrews).values({
        id: crewId,
        organizationId: orgId,
        projectId,
        name: 'Brigade Béton Armé',
        trade: 'Gros Œuvre',
        teamLeadId: primaryManagerId,
      } as any);

      await db.insert(crewMembers).values({
        crewId,
        userId: orgUsers[1],
      } as any);

      await db.insert(attendanceLogs).values({
        id: generateId(),
        organizationId: orgId,
        userId: orgUsers[1],
        projectId,
        clockInAt: new Date(),
        clockInMethod: 'gps_geofence',
        status: 'clocked_in',
      } as any);

      await db.insert(siteDailyLogs).values({
        id: generateId(),
        projectId,
        submittedById: primaryManagerId,
        logDate: new Date(),
        weatherConditions: 'Ensoleillé 25°C',
        workSummary: 'Coulage radier et ferraillage zone B.',
        safetyIncidentsReported: false,
      } as any);

      // Pointage Records (daily workforce headcount) — re-seeded for each
      // project: 5 company trades from the seeded trade catalog + up to 3
      // subcontractor entries. `pointage_records` has no user/crew FK columns,
      // so records reference the seeded `tradeCatalog` / `subcontractors`
      // (the crew + org users above set the date and counts context).
      const pointageDate = new Date();
      for (const trade of INITIAL_COMPANY_TRADES.slice(0, 5)) {
        const tradeId = tradeIdByName.get(trade.name);
        if (!tradeId) continue;
        await db.insert(pointageRecords).values({
          id: generateId(),
          projectId,
          date: pointageDate,
          tradeId,
          count: Math.max(1, (trade.count ?? 0) + faker.number.int({ min: -2, max: 3 })),
          isCompanyTrade: 1,
        } as any);
      }
      for (const sub of subRows.slice(0, 3)) {
        await db.insert(pointageRecords).values({
          id: generateId(),
          projectId,
          date: pointageDate,
          count: faker.number.int({ min: 2, max: 10 }),
          isCompanyTrade: 0,
          subcontractorId: sub.id,
        } as any);
      }

      // Audit Logs
      await db.insert(auditLogs).values({
        id: generateId(),
        organizationId: orgId,
        userId: primaryManagerId,
        action: 'PROJECT_CREATED',
        entityType: 'project',
        entityId: projectId,
        payload: { name: chantier.name },
      } as any);

      // Notes
      await db.insert(notes).values({
        id: generateId(),
        projectId,
        createdById: primaryManagerId,
        content: `Note de suivi de chantier pour ${chantier.name}. Avancement conforme aux prévisions.`,
      } as any);
    }
  }

  console.log('  ✅ Seeded all projects, equipment, RFIs, change orders, workforce crews, and audit logs');
  console.log('🌱 Comprehensive Faker database seed completed successfully!');
  await client.end();
}

seed().catch((err) => {
  console.error('❌ Database seed failed:', err);
  process.exit(1);
});

// Helper parsers
function parseFrenchDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const monthsFR = [
    'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
  ];
  const match = dateStr.match(/(\d{2})\s+(\w+\.?)\s+(\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthKey = match[2].endsWith('.') ? match[2] : match[2] + '.';
  const monthIndex = monthsFR.indexOf(monthKey);
  if (monthIndex === -1) return null;
  const year = parseInt(match[3], 10);
  return new Date(year, monthIndex, day);
}

function parseBudget(budgetStr: string): number | null {
  const cleaned = budgetStr.replace(/\s/g, '').replace(/MAD$/, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseSurface(surfaceStr: string): number | null {
  const cleaned = surfaceStr.replace(/\s/g, '').replace(/m²$/, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseComplianceScore(scoreStr: string | undefined): number | null {
  if (!scoreStr) return null;
  const cleaned = scoreStr.replace(/%$/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseScheduleDelta(scheduleStr: string | undefined): number | null {
  if (!scheduleStr) return null;
  const match = scheduleStr.match(/([+-]?\d+)\s*jours/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function mapOperationalStatusToLifecycle(status: string): string {
  switch (status) {
    case 'en_cours': return 'in_progress';
    case 'en_retard': return 'in_progress';
    case 'probleme': return 'in_progress';
    case 'termine': return 'completed';
    default: return 'planning';
  }
}
