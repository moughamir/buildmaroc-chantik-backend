import { z } from 'zod';

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
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
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

export const projectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().max(50).optional(),
  region: z.string().min(1).max(100),
  coordinates: z.object({
    lng: z.number(),
    lat: z.number(),
  }).optional(),
  status: z.enum(['planning', 'in_progress', 'completed', 'archived']).optional(),
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
});

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
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const userPreferencesUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  offlineModeDefault: z.boolean().optional(),
});

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
});

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
});

// ============================================================================
// 12. CONSTRUCTION ENGINEERING (additional schemas)
// ============================================================================

export const rfiUpdateSchema = z.object({
  answer: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'answered', 'closed']).optional(),
  assignedToId: z.string().uuid().optional(),
});

export const changeOrderUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'invoiced']),
  approvedById: z.string().uuid().optional(),
});

export const equipmentUpdateSchema = z.object({
  status: z.enum(['available', 'in_use', 'maintenance', 'decommissioned']).optional(),
  currentProjectId: z.string().uuid().optional(),
  lastServiceDate: z.string().datetime().optional(),
});

export const noteCreateSchema = z.object({
  content: z.string().min(1),
});

export const noteUpdateSchema = z.object({
  content: z.string().min(1).optional(),
});

export const pointageRecordCreateSchema = z.object({
  tradeId: z.string().uuid().optional(),
  count: z.number().int().nonnegative(),
  isCompanyTrade: z.boolean(),
  subcontractorId: z.string().uuid().optional(),
});

export const pointageRecordUpdateSchema = z.object({
  count: z.number().int().nonnegative().optional(),
});

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