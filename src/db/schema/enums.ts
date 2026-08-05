import { pgRole, pgEnum } from 'drizzle-orm/pg-core';

export const authenticatedRole = pgRole('authenticated').existing();

export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['starter', 'pro', 'enterprise']);
export const projectStatusEnum = pgEnum('project_status', ['planning', 'in_progress', 'completed', 'archived']);
export const projectRoleEnum = pgEnum('project_role', ['architect', 'project_manager', 'auditor', 'client', 'contractor']);
export const hotspotStatusEnum = pgEnum('hotspot_status', ['compliant', 'issue', 'pending', 'resolved']);
export const webhookEventEnum = pgEnum('webhook_event', ['project.created', 'hotspot.resolved', 'panorama.uploaded']);
export const permissionActionEnum = pgEnum('permission_action', ['create', 'read', 'update', 'delete', 'manage']);
export const resourceTypeEnum = pgEnum('resource_type', ['project', 'billing', 'team', 'member', 'webhook', 'api_key']);
export const shiftStatusEnum = pgEnum('shift_status', ['clocked_in', 'clocked_out', 'on_break', 'flagged']);
export const attendanceMethodEnum = pgEnum('attendance_method', ['gps_geofence', 'manual_override', 'qr_code', 'nfc_tag']);
export const rfiStatusEnum = pgEnum('rfi_status', ['draft', 'submitted', 'answered', 'closed']);
export const changeOrderstatusEnum = pgEnum('change_order_status', ['pending', 'approved', 'rejected', 'invoiced']);
export const equipmentStatusEnum = pgEnum('equipment_status', ['available', 'in_use', 'maintenance', 'decommissioned']);