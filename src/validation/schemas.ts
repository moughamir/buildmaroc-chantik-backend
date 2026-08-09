import { z } from 'zod';
import { createInsertSchema, createUpdateSchema, createSelectSchema } from 'drizzle-zod';
import { projects, zones, capturePoints, panoramas, hotspots } from '../db/schema/projects';
import { notes } from '../db/schema/notes';
import { pointageRecords, tradeCatalog } from '../db/schema/pointage';
import { rfis, changeOrders, blueprintSheets, equipment } from '../db/schema/construction';
import { workCrews, crewMembers, attendanceLogs, siteDailyLogs } from '../db/schema/workforce';
import { organizations, organizationMembers, organizationInvitations, teams, teamMembers } from '../db/schema/organizations';
import { users, userPreferences, userSecurityLogs } from '../db/schema/users';
import { customRoles, rolePermissions, userRoles } from '../db/schema/rbac';
import { subscriptions, invoices, apiKeys, webhooks } from '../db/schema/billing';
import { auditLogs } from '../db/schema/audit';
import { projectHealthView } from '../db/schema/views';

// ============================================================================
// 1. SYNC & OFFLINE MUTATIONS
// ============================================================================

export const createHotspotSchema = z.object({
  panoramaId: z.string().uuid(),
  createdById: z.string().uuid().optional(),
  pitch: z.string(),
  yaw: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['compliant', 'issue', 'pending', 'resolved']).optional(),
});

export const updateHotspotStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['compliant', 'issue', 'pending', 'resolved']),
});

export const mutationPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CREATE_HOTSPOT'),
    payload: createHotspotSchema,
    guid: z.string(),
  }),
  z.object({
    type: z.literal('UPDATE_HOTSPOT_STATUS'),
    payload: updateHotspotStatusSchema,
    guid: z.string(),
  }),
]);

export const syncBatchSchema = z.object({
  mutations: z.array(mutationPayloadSchema),
});

// ============================================================================
// 2. CAPTURE UPLOADS
// ============================================================================

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
});

// ============================================================================
// 3. WORKFORCE & ATTENDANCE
// ============================================================================

export const workCrewSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  trade: z.string().min(1).max(50),
  teamLeadId: z.string().uuid(),
});

export const crewMemberSchema = z.object({
  crewId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const attendanceClockInSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  clockInAt: z.string().datetime().optional(),
  clockInLocation: z.object({
    lng: z.number(),
    lat: z.number(),
  }).optional(),
  clockInMethod: z.enum(['gps_geofence', 'manual_override', 'qr_code', 'nfc_tag']).optional(),
});

export const attendanceClockOutSchema = z.object({
  id: z.string().uuid(),
  clockOutAt: z.string().datetime().optional(),
  clockOutLocation: z.object({
    lng: z.number(),
    lat: z.number(),
  }).optional(),
});

export const siteDailyLogSchema = z.object({
  projectId: z.string().uuid(),
  submittedById: z.string().uuid(),
  logDate: z.string().datetime(),
  weatherConditions: z.string().max(100).optional(),
  workSummary: z.string().min(1),
  safetyIncidentsReported: z.boolean().optional(),
  incidentDetails: z.string().optional(),
});

// ============================================================================
// 4. CONSTRUCTION DOMAIN
// ============================================================================

export const rfiSchema = z.object({
  projectId: z.string().uuid(),
  rfiNumber: z.number().int().positive(),
  title: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'answered', 'closed']).optional(),
  createdById: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const changeOrderSchema = z.object({
  projectId: z.string().uuid(),
  coNumber: z.string().min(1).max(50),
  title: z.string().min(1),
  description: z.string().min(1),
  costImpactCents: z.number().int().default(0),
  scheduleImpactDays: z.number().int().default(0),
  status: z.enum(['pending', 'approved', 'rejected', 'invoiced']).optional(),
  requestedById: z.string().uuid(),
  approvedById: z.string().uuid().optional(),
});

export const equipmentSchema = z.object({
  organizationId: z.string().uuid(),
  currentProjectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  serialNumber: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  status: z.enum(['available', 'in_use', 'maintenance', 'decommissioned']).optional(),
  lastServiceDate: z.string().datetime().optional(),
});

export const blueprintSheetSchema = z.object({
  projectId: z.string().uuid(),
  sheetNumber: z.string().min(1).max(50),
  title: z.string().min(1),
  version: z.number().int().positive().default(1),
  storagePath: z.string().min(1),
  uploadedById: z.string().uuid(),
});

// ============================================================================
// 5. USER & ORG MANAGEMENT
// ============================================================================

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().url().optional(),
});

export const organizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(100),
  billingEmail: z.string().email(),
});

export const organizationInvitationSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
  expiresAt: z.string().datetime(),
});

// Derived from the `projects` table (src/db/schema/projects.ts) via drizzle-zod
// so column names, types, and the status enum stay in sync with the DB.
// Refinements encode the API-facing contract on top of the derivation:
//   - `name`/`region` stay required and non-empty
//   - `code` is optional *without* null (the column is nullable; API inputs use undefined)
//   - `coordinates` is a typed { lng, lat } object (drizzle-zod maps the custom
//     geometry column to `z.any()` at runtime, so it is re-typed to the GeometryPoint shape)
//   - `status` keeps the table enum + default, so it stays optional on input
//   - internal columns (id, manager, budget, dates, progress, timestamps…) are not part of the body
export const projectSchema = createInsertSchema(projects, {
  name: (schema) => schema.min(1),
  code: z.string().max(50).optional(),
  region: (schema) => schema.min(1),
  coordinates: z.object({ lng: z.number(), lat: z.number() }).optional(),
}).omit({
  id: true,
  managerUserId: true,
  budgetCents: true,
  spentProgress: true,
  surfaceSqm: true,
  workersCount: true,
  startDate: true,
  expectedEndDate: true,
  complianceScore: true,
  scheduleDeltaDays: true,
  operationalStatus: true,
  createdAt: true,
});

// ============================================================================
// 6. TYPE INFERENCE HELPERS
// ============================================================================

export type CreateHotspotInput = z.infer<typeof createHotspotSchema>;
export type UpdateHotspotStatusInput = z.infer<typeof updateHotspotStatusSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
export type WorkCrewInput = z.infer<typeof workCrewSchema>;
export type CrewMemberInput = z.infer<typeof crewMemberSchema>;
export type AttendanceClockInInput = z.infer<typeof attendanceClockInSchema>;
export type AttendanceClockOutInput = z.infer<typeof attendanceClockOutSchema>;
export type SiteDailyLogInput = z.infer<typeof siteDailyLogSchema>;
export type RfiInput = z.infer<typeof rfiSchema>;
export type ChangeOrderInput = z.infer<typeof changeOrderSchema>;
export type EquipmentInput = z.infer<typeof equipmentSchema>;
export type BlueprintSheetInput = z.infer<typeof blueprintSheetSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type OrganizationInput = z.infer<typeof organizationSchema>;
export type OrganizationInvitationInput = z.infer<typeof organizationInvitationSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;

// ============================================================================
// 7. ORGANIZATION MANAGEMENT (additional schemas)
// ============================================================================

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).max(100).optional(),
  billingEmail: z.string().email().optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const invitationAcceptSchema = z.object({
  token: z.string().uuid(),
  userId: z.string().uuid(),
});

export const teamCreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const teamMemberAssignSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

// ============================================================================
// 8. USER PREFERENCES & PROFILE (additional schemas)
// ============================================================================

export const userProfileUpdateSchema = z.object({
  name: z.string().optional(),
  image: z.string().url().optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const userPreferencesUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  offlineModeDefault: z.boolean().optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

// ============================================================================
// 9. RBAC (additional schemas)
// ============================================================================

export const customRoleCreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(50),
});

export const customRoleUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  permissions: z.array(z.object({
    resource: z.enum(['project', 'billing', 'team', 'member', 'webhook', 'api_key']),
    action: z.enum(['create', 'read', 'update', 'delete', 'manage']),
  })).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const userRoleAssignSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

// ============================================================================
// 10. BILLING & INTEGRATIONS (additional schemas)
// ============================================================================

export const checkoutSessionSchema = z.object({
  plan: z.enum(['starter', 'pro', 'enterprise']),
});

export const apiKeyCreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const webhookRegisterSchema = z.object({
  organizationId: z.string().uuid(),
  endpointUrl: z.string().url().min(1),
  secret: z.string().min(1),
  events: z.array(z.enum(['project.created', 'hotspot.resolved', 'panorama.uploaded'])),
});

// ============================================================================
// 11. PROJECTS, ZONES & CAPTURE (additional schemas)
// ============================================================================

export const zoneCreateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  level: z.string().max(50).optional(),
});

export const capturePointCreateSchema = z.object({
  zoneId: z.string().uuid(),
  title: z.string().min(1),
  coordinates: z.object({
    lng: z.number(),
    lat: z.number(),
  }),
});

export const panoramaUploadSchema = z.object({
  capturePointId: z.string().uuid(),
  storagePath: z.string().min(1),
  capturedAt: z.string().datetime(),
  uploadedById: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// REST-specific hotspot schemas. The sync-flavored schemas above embed the
// parent id (`panoramaId`) / row id (`id`) in the payload for offline replay;
// the REST routes take those ids from the URL instead, so the body must not
// require them. pitch/yaw stay `string` to match the `numeric` DB columns
// (Drizzle returns numeric as string).
export const createHotspotRestSchema = createHotspotSchema.omit({ panoramaId: true });

export const updateHotspotRestSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['compliant', 'issue', 'pending', 'resolved']).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

// ============================================================================
// 12. CONSTRUCTION ENGINEERING (additional schemas)
// ============================================================================

export const rfiUpdateSchema = z.object({
  answer: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'answered', 'closed']).optional(),
  assignedToId: z.string().uuid().optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const changeOrderUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'invoiced']),
  approvedById: z.string().uuid().optional(),
});

export const equipmentUpdateSchema = z.object({
  status: z.enum(['available', 'in_use', 'maintenance', 'decommissioned']).optional(),
  currentProjectId: z.string().uuid().optional(),
  lastServiceDate: z.string().datetime().optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

// Derived from the `notes` table. The router supplies projectId/createdById from
// the URL/auth context, so only `content` is part of the API body.
export const noteCreateSchema = createInsertSchema(notes, {
  content: (schema) => schema.min(1),
}).omit({ id: true, projectId: true, createdById: true, createdAt: true, updatedAt: true });

export const noteUpdateSchema = createUpdateSchema(notes, {
  content: (schema) => schema.min(1),
}).omit({ id: true, projectId: true, createdById: true, createdAt: true, updatedAt: true })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

// Derived from the `pointageRecords` table. The router supplies projectId from
// the URL, and `date` is not part of the create body today — both are omitted.
// Deliberate refinements vs. the raw table type:
//   - `isCompanyTrade` is an integer (0/1) DB column, but the API contract is a
//     boolean (the router converts `? 1 : 0`)
//   - `count` stays required on create despite the DB default (0)
//   - `tradeId`/`subcontractorId` are optional *without* null (nullable columns)
export const pointageRecordCreateSchema = createInsertSchema(pointageRecords, {
  tradeId: z.string().uuid().optional(),
  count: z.number().int().min(0),
  isCompanyTrade: z.boolean(),
  subcontractorId: z.string().uuid().optional(),
}).omit({ id: true, projectId: true, date: true, createdAt: true, updatedAt: true });

export const pointageRecordUpdateSchema = createUpdateSchema(pointageRecords, {
  count: (schema) => schema.min(0),
}).omit({ id: true, projectId: true, date: true, tradeId: true, isCompanyTrade: true, subcontractorId: true, createdAt: true, updatedAt: true })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

// Query-string filter for GET /projects/:projectId/pointage — not an insert
// shape, so it stays a plain hand-written schema (date arrives as an ISO string).
export const pointageQuerySchema = z.object({
  date: z.string().datetime().optional(),
});

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type PointageRecordCreateInput = z.infer<typeof pointageRecordCreateSchema>;
export type PointageRecordUpdateInput = z.infer<typeof pointageRecordUpdateSchema>;
export type PointageQueryInput = z.infer<typeof pointageQuerySchema>;
export type RfiUpdateInput = z.infer<typeof rfiUpdateSchema>;
export type ChangeOrderUpdateInput = z.infer<typeof changeOrderUpdateSchema>;
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamMemberAssignInput = z.infer<typeof teamMemberAssignSchema>;
export type CustomRoleCreateInput = z.infer<typeof customRoleCreateSchema>;
export type CustomRoleUpdateInput = z.infer<typeof customRoleUpdateSchema>;
export type UserRoleAssignInput = z.infer<typeof userRoleAssignSchema>;
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
export type WebhookRegisterInput = z.infer<typeof webhookRegisterSchema>;
export type ZoneCreateInput = z.infer<typeof zoneCreateSchema>;
export type CapturePointCreateInput = z.infer<typeof capturePointCreateSchema>;
export type PanoramaUploadInput = z.infer<typeof panoramaUploadSchema>;
export type CreateHotspotRestInput = z.infer<typeof createHotspotRestSchema>;
export type UpdateHotspotRestInput = z.infer<typeof updateHotspotRestSchema>;
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
export type UserPreferencesUpdateInput = z.infer<typeof userPreferencesUpdateSchema>;

// ============================================================================
// 13. RESPONSE SCHEMAS (L6b — OpenAPI doc + future typed RPC client)
// ============================================================================
// `createSelectSchema` derives the full select-* row shape so the documented
// responses (and the `AppType` used by a later `hc<AppType>()` client) match
// what the handlers actually return. The routers only consume these for the
// OpenAPI responses — they are never used to validate runtime output.

export const projectSelectSchema = createSelectSchema(projects);
export const noteSelectSchema = createSelectSchema(notes);
export const pointageRecordSelectSchema = createSelectSchema(pointageRecords);
export const zoneSelectSchema = createSelectSchema(zones);
export const rfiSelectSchema = createSelectSchema(rfis);
export const changeOrderSelectSchema = createSelectSchema(changeOrders);
export const blueprintSheetSelectSchema = createSelectSchema(blueprintSheets);
export const siteDailyLogSelectSchema = createSelectSchema(siteDailyLogs);
export const attendanceLogSelectSchema = createSelectSchema(attendanceLogs).pick({
  id: true,
  userId: true,
  clockInAt: true,
  clockOutAt: true,
  totalHours: true,
  isFlagged: true,
  flagReason: true,
  status: true,
});
export const projectHealthSelectSchema = createSelectSchema(projectHealthView);
export const tradeCatalogSelectSchema = createSelectSchema(tradeCatalog);

// GET /projects/{projectId} appends the nested `captures` array to the row.
export const projectWithCapturesSchema = projectSelectSchema.extend({
  captures: z.array(z.any()),
});

// Shared error/ack shapes returned by the converted routes.
export const errorResponseSchema = z.object({ error: z.string() });
export const deletedResponseSchema = z.object({ deleted: z.boolean() });
export const removedResponseSchema = z.object({ removed: z.boolean() });

// ============================================================================
// 14. RESPONSE SCHEMAS — L6e converted routers (orgs, users, crews, sync,
//     captures, spatial, attendance, construction-root, admin)
// ============================================================================

export const organizationSelectSchema = createSelectSchema(organizations);
export const organizationMemberSelectSchema = createSelectSchema(organizationMembers);
export const organizationInvitationSelectSchema = createSelectSchema(organizationInvitations);
export const teamSelectSchema = createSelectSchema(teams);
export const teamMemberSelectSchema = createSelectSchema(teamMembers);
export const customRoleSelectSchema = createSelectSchema(customRoles);
export const rolePermissionSelectSchema = createSelectSchema(rolePermissions);
export const userRoleSelectSchema = createSelectSchema(userRoles);
export const subscriptionSelectSchema = createSelectSchema(subscriptions);
export const invoiceSelectSchema = createSelectSchema(invoices);
export const apiKeySelectSchema = createSelectSchema(apiKeys);
export const webhookSelectSchema = createSelectSchema(webhooks);
export const userSelectSchema = createSelectSchema(users);
export const userPreferenceSelectSchema = createSelectSchema(userPreferences);
export const userSecurityLogSelectSchema = createSelectSchema(userSecurityLogs);
export const workCrewSelectSchema = createSelectSchema(workCrews);
export const crewMemberSelectSchema = createSelectSchema(crewMembers);
export const capturePointSelectSchema = createSelectSchema(capturePoints);
export const panoramaSelectSchema = createSelectSchema(panoramas);
export const hotspotSelectSchema = createSelectSchema(hotspots);
export const equipmentSelectSchema = createSelectSchema(equipment);
export const auditLogSelectSchema = createSelectSchema(auditLogs);

// Organization list projection (GET /api/v1/organizations).
export const organizationListSelectSchema = organizationSelectSchema.pick({
  id: true,
  name: true,
  slug: true,
  billingEmail: true,
  createdAt: true,
});

// Org member list projection (GET /:orgId/members) — member row joined with user email/name.
export const orgMemberWithUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.string(),
  createdAt: z.date(),
  email: z.string(),
  name: z.string().nullable(),
});

// Crew list projection (GET /:orgId/crews) — crew row joined with team lead name.
export const crewWithLeadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  trade: z.string(),
  teamLeadId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  createdAt: z.date(),
  leadName: z.string().nullable(),
});

// API-key list projection (GET /:orgId/api-keys) and create response (POST adds raw key).
export const apiKeyListSelectSchema = apiKeySelectSchema.pick({
  id: true,
  name: true,
  prefix: true,
  createdAt: true,
});
export const apiKeyWithKeySchema = apiKeySelectSchema.extend({ key: z.string() });

// Billing checkout mock response.
export const checkoutResponseSchema = z.object({
  checkoutUrl: z.string(),
  plan: z.string(),
});

// Org export (GET /:orgId/export) — JSON payload; the CSV branch returns a raw Response.
export const exportDataSchema = z.object({
  exportedAt: z.string(),
  organizationId: z.string().uuid(),
  projects: z.array(projectSelectSchema),
  members: z.array(organizationMemberSelectSchema),
  invoices: z.array(invoiceSelectSchema),
});

// Capture upload URL (POST /api/v1/captures/upload-url).
export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string(),
  path: z.string(),
});

// Sync pull (GET /api/v1/sync/pull).
export const syncPullResponseSchema = z.object({
  timestamp: z.string(),
  changes: z.object({
    hotspots: z.array(hotspotSelectSchema),
  }),
});

// Sync batch (POST /api/v1/sync/batch).
export const syncBatchResponseSchema = z.object({
  processed: z.array(z.object({
    clientGuid: z.string(),
    status: z.literal('synced'),
    data: z.any(),
  })),
});

// Platform-admin response shapes (GET /api/v1/admin/*).
export const adminMetricsSchema = z.object({
  totalOrganizations: z.number(),
  totalProjects: z.number(),
  totalSubscriptions: z.number(),
  totalAuditEvents: z.number(),
  status: z.string(),
  uptime: z.number(),
  timestamp: z.string(),
});
export const adminOrganizationSchema = organizationSelectSchema.extend({
  subscription: z.any(),
  projectCount: z.number(),
  memberCount: z.number(),
});
export const adminAuditLogSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  orgName: z.string().nullable(),
  userId: z.string().uuid().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  payload: z.any().nullable(),
  createdAt: z.date(),
});
export const adminWebhookSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  orgName: z.string().nullable(),
  endpointUrl: z.string(),
  isActive: z.boolean(),
  events: z.array(z.string()),
});