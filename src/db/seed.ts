import { db, client } from './index';
import {
  users,
  organizations,
  organizationMembers,
  teams,
  teamMembers,
  subscriptions,
  invoices,
  customRoles,
  rolePermissions,
  userRoles,
  projects,
  zones,
  capturePoints,
  panoramas,
  hotspots,
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

function parseFrenchDate(dateStr: string): Date | null {
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

function parseComplianceScore(scoreStr: string): number | null {
  const cleaned = scoreStr.replace(/%$/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseScheduleDelta(scheduleStr: string): number | null {
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

async function seed() {
  console.log('🌱 Starting comprehensive database seed...');

  // --- Idempotent Cleanup (reverse order of foreign keys) ---
  await db.delete(pointageRecords);
  await db.delete(subcontractors);
  await db.delete(tradeCatalog);
  await db.delete(notes);
  await db.delete(hotspots);
  await db.delete(panoramas);
  await db.delete(capturePoints);
  await db.delete(zones);
  await db.delete(projects);
  await db.delete(invoices);
  await db.delete(subscriptions);
  await db.delete(teamMembers);
  await db.delete(teams);
  await db.delete(userRoles);
  await db.delete(rolePermissions);
  await db.delete(customRoles);
  await db.delete(organizationMembers);
  await db.delete(organizations);
  await db.delete(users);
  console.log('  🧹 Cleaned existing database records');

  // --- Users ---
  const userKarimId = generateId();
  const userAhmedId = generateId();
  const userYoussefId = generateId();
  const userSihamId = generateId();
  const userRachidId = generateId();
  const userLeilaId = generateId();

  await db.insert(users).values([
    { id: userKarimId, email: 'admin@buildmaroc.ma', fullName: 'Karim Benali (SaaS Owner)' },
    { id: userAhmedId, email: 'a.benali@buildmaroc.ma', fullName: 'Ahmed Benali' },
    { id: userYoussefId, email: 'y.amrani@buildmaroc.ma', fullName: 'Youssef El Amrani' },
    { id: userSihamId, email: 's.bennani@buildmaroc.ma', fullName: 'Siham Bennani' },
    { id: userRachidId, email: 'r.kabbaj@atlasbtp.ma', fullName: 'Rachid Kabbaj' },
    { id: userLeilaId, email: 'l.tazi@casare.ma', fullName: 'Leila Tazi' },
  ] as any);
  console.log('  ✅ Users created (6 users)');

  // --- Organizations (3 tiers: enterprise, pro, starter) ---
  const orgBuildMarocId = generateId();
  const orgAtlasId = generateId();
  const orgCasaReId = generateId();

  await db.insert(organizations).values([
    { id: orgBuildMarocId, name: 'BuildMaroc', slug: 'buildmaroc', billingEmail: 'billing@buildmaroc.ma' },
    { id: orgAtlasId, name: 'Atlas BTP & Associés', slug: 'atlas-btp', billingEmail: 'contact@atlasbtp.ma' },
    { id: orgCasaReId, name: 'Casablanca Real Estate', slug: 'casa-re', billingEmail: 'finance@casare.ma' },
  ] as any);
  console.log('  ✅ Organizations created (3 orgs)');

  // --- Subscriptions & Invoices ---
  await db.insert(subscriptions).values([
    { id: generateId(), organizationId: orgBuildMarocId, plan: 'enterprise', status: 'active', maxProjects: 50 },
    { id: generateId(), organizationId: orgAtlasId, plan: 'pro', status: 'active', maxProjects: 15 },
    { id: generateId(), organizationId: orgCasaReId, plan: 'starter', status: 'active', maxProjects: 5 },
  ] as any);

  await db.insert(invoices).values([
    { id: generateId(), organizationId: orgBuildMarocId, externalId: 'inv_bm_001', amountDue: 99900, amountPaid: 99900, status: 'paid', hostedInvoiceUrl: 'https://billing.stripe.com/invoice/inv_bm_001' },
    { id: generateId(), organizationId: orgAtlasId, externalId: 'inv_atlas_001', amountDue: 49900, amountPaid: 49900, status: 'paid', hostedInvoiceUrl: 'https://billing.stripe.com/invoice/inv_atlas_001' },
  ] as any);
  console.log('  ✅ Subscriptions & Invoices seeded');

  // --- Organization Members ---
  await db.insert(organizationMembers).values([
    { organizationId: orgBuildMarocId, userId: userKarimId, role: 'saas_owner' },
    { organizationId: orgBuildMarocId, userId: userAhmedId, role: 'admin' },
    { organizationId: orgBuildMarocId, userId: userYoussefId, role: 'member' },
    { organizationId: orgBuildMarocId, userId: userSihamId, role: 'member' },
    { organizationId: orgAtlasId, userId: userRachidId, role: 'owner' },
    { organizationId: orgCasaReId, userId: userLeilaId, role: 'owner' },
  ] as any);

  // --- Teams & Team Members ---
  const teamGrosOeuvreId = generateId();
  const teamFinitionsId = generateId();
  await db.insert(teams).values([
    { id: teamGrosOeuvreId, organizationId: orgBuildMarocId, name: 'Équipe Gros Œuvre' },
    { id: teamFinitionsId, organizationId: orgBuildMarocId, name: 'Équipe Finitions & Second Œuvre' },
  ] as any);

  await db.insert(teamMembers).values([
    { teamId: teamGrosOeuvreId, userId: userAhmedId },
    { teamId: teamGrosOeuvreId, userId: userYoussefId },
    { teamId: teamFinitionsId, userId: userSihamId },
  ] as any);
  console.log('  ✅ Teams & team memberships created');

  // --- SaaS Owner Custom Role & Permissions ---
  const saasOwnerRoleId = generateId();
  await db.insert(customRoles).values({
    id: saasOwnerRoleId,
    organizationId: orgBuildMarocId,
    name: 'SaaS Platform Owner',
    isSystem: true,
  } as any);

  const resources = ['project', 'billing', 'team', 'member', 'webhook', 'api_key'] as const;
  for (const resource of resources) {
    await db.insert(rolePermissions).values({
      roleId: saasOwnerRoleId,
      resource,
      action: 'manage',
    } as any);
  }

  await db.insert(userRoles).values({
    userId: userKarimId,
    roleId: saasOwnerRoleId,
    organizationId: orgBuildMarocId,
  } as any);
  console.log('  ✅ Custom RBAC roles and permissions seeded');

  // --- Trade Catalog ---
  const tradeIds: Record<string, string> = {};
  for (const trade of INITIAL_COMPANY_TRADES) {
    const tradeId = generateId();
    tradeIds[trade.id] = tradeId;
    await db.insert(tradeCatalog).values({
      id: tradeId,
      name: trade.name,
      category: trade.category,
      icon: trade.icon,
      description: trade.description || null,
    } as any);
  }
  console.log(`  ✅ Trade catalog seeded (${INITIAL_COMPANY_TRADES.length} trades)`);

  // --- Projects, Zones, Captures, Panoramas, Hotspots, Subcontractors, Pointage ---
  for (const chantier of INITIAL_CHANTIERS) {
    const projectId = generateId();
    const startDate = parseFrenchDate(chantier.startDate);
    const expectedEndDate = parseFrenchDate(chantier.expectedEndDate);

    await db.insert(projects).values({
      id: projectId,
      organizationId: orgBuildMarocId,
      name: chantier.name,
      code: chantier.code,
      region: chantier.location,
      coordinates: { lng: chantier.lng, lat: chantier.lat },
      status: mapOperationalStatusToLifecycle(chantier.status),
      operationalStatus: chantier.status,
      managerUserId: userAhmedId,
      budgetCents: parseBudget(chantier.budget) ?? null,
      spentProgress: chantier.spentProgress,
      surfaceSqm: parseSurface(chantier.surface) ?? null,
      workersCount: chantier.workersCount,
      complianceScore: parseComplianceScore(chantier.complianceScore) ?? null,
      scheduleDeltaDays: parseScheduleDelta(chantier.scheduleAhead) ?? null,
      startDate: startDate ?? null,
      expectedEndDate: expectedEndDate ?? null,
    } as any);

    // --- Subcontractors ---
    const subsData = INITIAL_SUBCONTRACTORS[chantier.id] || [];
    for (const sub of subsData) {
      await db.insert(subcontractors).values({
        id: generateId(),
        projectId,
        company: sub.company,
        specialty: sub.specialty,
      } as any);
    }

    // --- Zones & Captures ---
    for (const capture of chantier.captures) {
      for (const zone of capture.zones) {
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
          uploadedById: userAhmedId,
          metadata: {
            week: capture.week,
            progress: capture.progress,
            operator: capture.operator,
            note: capture.note,
          },
        } as any);

        for (const hotspot of capture.hotspots) {
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

    // --- Sample Notes ---
    await db.insert(notes).values([
      {
        id: generateId(),
        projectId,
        createdById: userAhmedId,
        content: `Rapport journalier validé pour le chantier ${chantier.name}. RAS sur la conformité LPEE.`,
      },
    ] as any);
  }

  console.log('  ✅ Comprehensive project data, zones, 360° panoramas & pointage seeded');
  console.log('🌱 Database seed completed successfully!');
  await client.end();
}

seed().catch((err) => {
  console.error('❌ Database seed failed:', err);
  process.exit(1);
});
