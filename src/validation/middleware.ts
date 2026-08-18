import { zValidator } from '@hono/zod-validator';
import type { MiddlewareHandler } from 'hono';
import {
  syncBatchSchema,
  uploadUrlSchema,
  workCrewSchema,
  crewMemberSchema,
  attendanceClockInSchema,
  attendanceClockOutSchema,
  siteDailyLogSchema,
  rfiSchema,
  changeOrderSchema,
  equipmentSchema,
  blueprintSheetSchema,
  userSchema,
  organizationSchema,
  organizationInvitationSchema,
  projectSchema,
  updateOrganizationSchema,
  invitationAcceptSchema,
  teamCreateSchema,
  teamMemberAssignSchema,
  userProfileUpdateSchema,
  userPreferencesUpdateSchema,
  customRoleCreateSchema,
  customRoleUpdateSchema,
  userRoleAssignSchema,
  checkoutSessionSchema,
  apiKeyCreateSchema,
  webhookRegisterSchema,
  zoneCreateSchema,
  capturePointCreateSchema,
  panoramaUploadSchema,
  rfiUpdateSchema,
  changeOrderUpdateSchema,
  equipmentUpdateSchema,
  createHotspotSchema,
  updateHotspotStatusSchema,
  createHotspotRestSchema,
  updateHotspotRestSchema,
  noteCreateSchema,
  noteUpdateSchema,
  pointageRecordCreateSchema,
  pointageRecordUpdateSchema,
  pointageQuerySchema,
} from './schemas';

export const validateSyncBatch = zValidator('json', syncBatchSchema);
export const validateUploadUrl = zValidator('json', uploadUrlSchema);
export const validateWorkCrew = zValidator('json', workCrewSchema);
export const validateCrewMember = zValidator('json', crewMemberSchema);
export const validateAttendanceClockIn = zValidator('json', attendanceClockInSchema);
export const validateAttendanceClockOut = zValidator('json', attendanceClockOutSchema);
export const validateSiteDailyLog = zValidator('json', siteDailyLogSchema);
export const validateRfi = zValidator('json', rfiSchema);
export const validateChangeOrder = zValidator('json', changeOrderSchema);
export const validateEquipment = zValidator('json', equipmentSchema);
export const validateBlueprintSheet = zValidator('json', blueprintSheetSchema);
export const validateUser = zValidator('json', userSchema);
export const validateOrganization = zValidator('json', organizationSchema);
export const validateOrganizationInvitation = zValidator('json', organizationInvitationSchema);
export const validateProject = zValidator('json', projectSchema);
export const validateUpdateOrganization = zValidator('json', updateOrganizationSchema);
export const validateInvitationAccept = zValidator('json', invitationAcceptSchema);
export const validateTeamCreate = zValidator('json', teamCreateSchema);
export const validateTeamMemberAssign = zValidator('json', teamMemberAssignSchema);
export const validateUserProfileUpdate = zValidator('json', userProfileUpdateSchema);
export const validateUserPreferencesUpdate = zValidator('json', userPreferencesUpdateSchema);
export const validateCustomRoleCreate = zValidator('json', customRoleCreateSchema);
export const validateCustomRoleUpdate = zValidator('json', customRoleUpdateSchema);
export const validateUserRoleAssign = zValidator('json', userRoleAssignSchema);
export const validateCheckoutSession = zValidator('json', checkoutSessionSchema);
export const validateApiKeyCreate = zValidator('json', apiKeyCreateSchema);
export const validateWebhookRegister = zValidator('json', webhookRegisterSchema);
export const validateZoneCreate = zValidator('json', zoneCreateSchema);
export const validateCapturePointCreate = zValidator('json', capturePointCreateSchema);
export const validatePanoramaUpload = zValidator('json', panoramaUploadSchema);
export const validateRfiUpdate = zValidator('json', rfiUpdateSchema);
export const validateChangeOrderUpdate = zValidator('json', changeOrderUpdateSchema);
export const validateEquipmentUpdate = zValidator('json', equipmentUpdateSchema);
export const validateCreateHotspot = zValidator('json', createHotspotSchema);
export const validateUpdateHotspotStatus = zValidator('json', updateHotspotStatusSchema);
export const validateCreateHotspotRest = zValidator('json', createHotspotRestSchema);
export const validateUpdateHotspotRest = zValidator('json', updateHotspotRestSchema);
export const validateNoteCreate = zValidator('json', noteCreateSchema);
export const validateNoteUpdate = zValidator('json', noteUpdateSchema);
export const validatePointageRecordCreate = zValidator('json', pointageRecordCreateSchema);
export const validatePointageRecordUpdate = zValidator('json', pointageRecordUpdateSchema);
export const validatePointageQuery = zValidator('query', pointageQuerySchema);

export function validateParam(schema: Record<string, unknown>): MiddlewareHandler {
  return zValidator('param', schema as any);
}

export function validateQuery(schema: Record<string, unknown>): MiddlewareHandler {
  return zValidator('query', schema as any);
}