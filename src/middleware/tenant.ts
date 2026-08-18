import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  organizationMembers,
  projects,
  zones,
  capturePoints,
  panoramas,
  hotspots,
  rfis,
  changeOrders,
  pointageRecords,
  subcontractors,
  workCrews,
  equipment,
} from '../db/schema';
import type { SessionVariables } from './session';

/**
 * S6: cross-tenant isolation guards.
 *
 * Every domain resource chains up to an organization
 * (organizations → projects → zones/capturePoints/panoramas/hotspots/notes/
 * rfis/changeOrders/blueprints/workCrews/attendance/pointageRecords → …). The
 * guards below enforce that a caller may only touch resources that belong to
 * an organization they are a member of. Error shapes follow the existing
 * convention: `{ error: '…' }` with 401 / 403 / 404 status codes.
 *
 * Dev bypass mirrors src/middleware/session.ts exactly: checks are skipped
 * only when NODE_ENV !== 'production' AND an `x-user-id` header is present AND
 * no `Authorization` header — never in production.
 */

/** Hono context carrying the session middleware's resolved variables. */
export type TenantCtx = Context<{ Variables: SessionVariables }>;

export type OrgRole = 'owner' | 'admin' | 'member';
export type OrgAdminRole = 'owner' | 'admin';

const ROLE_LEVEL: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1 };

/**
 * Dev-bypass gate — mirrors src/middleware/session.ts: bypass is honored only
 * when NODE_ENV !== 'production' AND an `x-user-id` header is present AND no
 * `Authorization` header. Under bypass every tenant check passes through so the
 * local frontend (x-user-id: 'dev-admin-user') keeps working against seeded data.
 */
export function isDevBypass(c: TenantCtx): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    !!c.req.header('x-user-id') &&
    !c.req.header('Authorization')
  );
}

/** One-query helper: the caller's role in an org, or null when not a member. */
export async function getMemberRole(orgId: string, userId: string): Promise<OrgRole | null> {
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId),
    ))
    .limit(1);
  return (member?.role ?? null) as OrgRole | null;
}

/**
 * Shared ownership decision for resource guards: 401 when the caller cannot be
 * identified, 404 when the row is missing, 403 when the row's org is not the
 * caller's org. When the session carries no active org (c.get('orgId') null),
 * falls back to a direct membership check on the row's org so a member without
 * an active org can still reach their own org's resources.
 */
async function guardOrgOwned(
  c: TenantCtx,
  row: { organizationId: string } | undefined,
  notFoundBody: { error: string },
): Promise<Response | null> {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  if (!row) return c.json(notFoundBody, 404);
  const orgId = c.get('orgId');
  if (orgId) {
    if (row.organizationId !== orgId) return c.json({ error: 'Forbidden' }, 403);
  } else {
    const role = await getMemberRole(row.organizationId, userId);
    if (!role) return c.json({ error: 'Forbidden' }, 403);
  }
  return null;
}

/** 401 if no resolved user context; 403 if the caller is not a member of the org. */
export async function requireOrgMembership(c: TenantCtx, orgId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  const role = await getMemberRole(orgId, userId);
  if (!role) return c.json({ error: 'Forbidden' }, 403);
  return null;
}

/** Same as requireOrgMembership + role gate ('owner' >= 'admin' >= 'member'). */
export async function requireOrgRole(
  c: TenantCtx,
  orgId: string,
  minRole: OrgAdminRole,
): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Authentication required' }, 401);
  const role = await getMemberRole(orgId, userId);
  if (!role) return c.json({ error: 'Forbidden' }, 403);
  if (ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) return c.json({ error: 'Forbidden' }, 403);
  return null;
}

/** The project must exist and belong to the caller's org. */
export async function requireProjectInOrg(c: TenantCtx, projectId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return guardOrgOwned(c, project, { error: 'Project not found' });
}

/** zones.projectId → projects.organizationId. */
export async function requireZoneInOrg(c: TenantCtx, zoneId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(zones)
    .innerJoin(projects, eq(projects.id, zones.projectId))
    .where(eq(zones.id, zoneId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Zone not found' });
}

/** capturePoints.zoneId → zones.projectId → projects.organizationId. */
export async function requireCapturePointInOrg(c: TenantCtx, cpId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(capturePoints)
    .innerJoin(zones, eq(zones.id, capturePoints.zoneId))
    .innerJoin(projects, eq(projects.id, zones.projectId))
    .where(eq(capturePoints.id, cpId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Capture point not found' });
}

/** panoramas.capturePointId → capturePoints → zones → projects → org. */
export async function requirePanoramaInOrg(c: TenantCtx, panoramaId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(panoramas)
    .innerJoin(capturePoints, eq(capturePoints.id, panoramas.capturePointId))
    .innerJoin(zones, eq(zones.id, capturePoints.zoneId))
    .innerJoin(projects, eq(projects.id, zones.projectId))
    .where(eq(panoramas.id, panoramaId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Panorama not found' });
}

/** hotspots.panoramaId → panoramas → capturePoints → zones → projects → org. */
export async function requireHotspotInOrg(c: TenantCtx, hotspotId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(hotspots)
    .innerJoin(panoramas, eq(panoramas.id, hotspots.panoramaId))
    .innerJoin(capturePoints, eq(capturePoints.id, panoramas.capturePointId))
    .innerJoin(zones, eq(zones.id, capturePoints.zoneId))
    .innerJoin(projects, eq(projects.id, zones.projectId))
    .where(eq(hotspots.id, hotspotId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Hotspot not found' });
}

/** rfis.projectId → projects.organizationId. */
export async function requireRfiInOrg(c: TenantCtx, rfiId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(rfis)
    .innerJoin(projects, eq(projects.id, rfis.projectId))
    .where(eq(rfis.id, rfiId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'RFI not found' });
}

/** changeOrders.projectId → projects.organizationId. */
export async function requireChangeOrderInOrg(c: TenantCtx, coId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(changeOrders)
    .innerJoin(projects, eq(projects.id, changeOrders.projectId))
    .where(eq(changeOrders.id, coId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Change order not found' });
}

/** pointageRecords.projectId → projects.organizationId. */
export async function requirePointageRecordInOrg(c: TenantCtx, recordId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(pointageRecords)
    .innerJoin(projects, eq(projects.id, pointageRecords.projectId))
    .where(eq(pointageRecords.id, recordId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Pointage record not found' });
}

/** subcontractors.projectId → projects.organizationId. */
export async function requireSubcontractorInOrg(c: TenantCtx, subId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(subcontractors)
    .innerJoin(projects, eq(projects.id, subcontractors.projectId))
    .where(eq(subcontractors.id, subId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Subcontractor not found' });
}

/** workCrews carries organizationId directly. */
export async function requireCrewInOrg(c: TenantCtx, crewId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: workCrews.organizationId })
    .from(workCrews)
    .where(eq(workCrews.id, crewId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Crew not found' });
}

/** equipment carries organizationId directly. */
export async function requireEquipmentInOrg(c: TenantCtx, equipmentId: string): Promise<Response | null> {
  if (isDevBypass(c)) return null;
  const [row] = await db
    .select({ organizationId: equipment.organizationId })
    .from(equipment)
    .where(eq(equipment.id, equipmentId))
    .limit(1);
  return guardOrgOwned(c, row, { error: 'Equipment not found' });
}
