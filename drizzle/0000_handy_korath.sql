-- PostGIS is required by the schema (geometry columns + GiST indexes below).
-- Added manually: drizzle-kit does not emit CREATE EXTENSION for custom types.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."attendance_method" AS ENUM('gps_geofence', 'manual_override', 'qr_code', 'nfc_tag');--> statement-breakpoint
CREATE TYPE "public"."change_order_status" AS ENUM('pending', 'approved', 'rejected', 'invoiced');--> statement-breakpoint
CREATE TYPE "public"."equipment_status" AS ENUM('available', 'in_use', 'maintenance', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."hotspot_status" AS ENUM('compliant', 'issue', 'pending', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."operational_status" AS ENUM('en_cours', 'en_retard', 'probleme', 'termine');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."permission_action" AS ENUM('create', 'read', 'update', 'delete', 'manage');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('architect', 'project_manager', 'auditor', 'client', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'in_progress', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('project', 'billing', 'team', 'member', 'webhook', 'api_key');--> statement-breakpoint
CREATE TYPE "public"."rfi_status" AS ENUM('draft', 'submitted', 'answered', 'closed');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('clocked_in', 'clocked_out', 'on_break', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('project.created', 'hotspot.resolved', 'panorama.uploaded');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_in_location" geometry(Point, 4326),
	"clock_in_method" "attendance_method" DEFAULT 'gps_geofence' NOT NULL,
	"clock_out_at" timestamp with time zone,
	"clock_out_location" geometry(Point, 4326),
	"status" "shift_status" DEFAULT 'clocked_in' NOT NULL,
	"total_hours" integer,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb,
	"client_guid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sheet_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capture_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"title" text NOT NULL,
	"coordinates" geometry(Point, 4326)
);
--> statement-breakpoint
CREATE TABLE "change_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"co_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"cost_impact_cents" integer DEFAULT 0 NOT NULL,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"status" "change_order_status" DEFAULT 'pending' NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"crew_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crew_members_crew_id_user_id_pk" PRIMARY KEY("crew_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"current_project_id" uuid,
	"name" varchar(100) NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"status" "equipment_status" DEFAULT 'available' NOT NULL,
	"last_service_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "hotspots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panorama_id" uuid NOT NULL,
	"created_by_id" uuid,
	"pitch" numeric NOT NULL,
	"yaw" numeric NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "hotspot_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"amount_due" integer NOT NULL,
	"amount_paid" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"hosted_invoice_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"invited_by_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"billing_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "panoramas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capture_point_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"uploaded_by_id" uuid,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "pointage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"trade_id" uuid,
	"count" integer DEFAULT 0 NOT NULL,
	"is_company_trade" integer NOT NULL,
	"subcontractor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_role" "project_role" NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" varchar(50),
	"region" varchar(100) NOT NULL,
	"coordinates" geometry(Point, 4326),
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"manager_user_id" uuid,
	"budget_cents" integer,
	"spent_progress" integer,
	"surface_sqm" numeric,
	"workers_count" integer,
	"start_date" timestamp with time zone,
	"expected_end_date" timestamp with time zone,
	"compliance_score" numeric,
	"schedule_delta_days" integer,
	"operational_status" "operational_status" DEFAULT 'en_cours',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"rfi_number" integer NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"status" "rfi_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"assigned_to_id" uuid,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"resource" "resource_type" NOT NULL,
	"action" "permission_action" NOT NULL,
	CONSTRAINT "role_permissions_role_id_resource_action_pk" PRIMARY KEY("role_id","resource","action")
);
--> statement-breakpoint
CREATE TABLE "site_daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"submitted_by_id" uuid NOT NULL,
	"log_date" timestamp with time zone NOT NULL,
	"weather_conditions" varchar(100),
	"work_summary" text NOT NULL,
	"safety_incidents_reported" boolean DEFAULT false NOT NULL,
	"incident_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcontractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"company" text NOT NULL,
	"specialty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" "subscription_plan" DEFAULT 'starter' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"max_projects" integer DEFAULT 5,
	"current_period_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"icon" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" varchar(20) DEFAULT 'system' NOT NULL,
	"locale" varchar(10) DEFAULT 'fr-FR' NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"offline_mode_default" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_organization_id_pk" PRIMARY KEY("user_id","role_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "user_security_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"endpoint_url" text NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"events" "webhook_event"[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_crews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(100) NOT NULL,
	"trade" varchar(50) NOT NULL,
	"team_lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" varchar(50)
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_sheets" ADD CONSTRAINT "blueprint_sheets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_sheets" ADD CONSTRAINT "blueprint_sheets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_points" ADD CONSTRAINT "capture_points_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_id_work_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."work_crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_current_project_id_projects_id_fk" FOREIGN KEY ("current_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspots" ADD CONSTRAINT "hotspots_panorama_id_panoramas_id_fk" FOREIGN KEY ("panorama_id") REFERENCES "public"."panoramas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspots" ADD CONSTRAINT "hotspots_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panoramas" ADD CONSTRAINT "panoramas_capture_point_id_capture_points_id_fk" FOREIGN KEY ("capture_point_id") REFERENCES "public"."capture_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panoramas" ADD CONSTRAINT "panoramas_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointage_records" ADD CONSTRAINT "pointage_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointage_records" ADD CONSTRAINT "pointage_records_trade_id_trade_catalog_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pointage_records" ADD CONSTRAINT "pointage_records_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."subcontractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_custom_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_daily_logs" ADD CONSTRAINT "site_daily_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_daily_logs" ADD CONSTRAINT "site_daily_logs_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractors" ADD CONSTRAINT "subcontractors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_custom_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_security_logs" ADD CONSTRAINT "user_security_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_crews" ADD CONSTRAINT "work_crews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_crews" ADD CONSTRAINT "work_crews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_crews" ADD CONSTRAINT "work_crews_team_lead_id_users_id_fk" FOREIGN KEY ("team_lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_org_idx" ON "attendance_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "attendance_user_idx" ON "attendance_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_project_idx" ON "attendance_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "attendance_location_gist_idx" ON "attendance_logs" USING gist ("clock_in_location");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_client_guid_idx" ON "audit_logs" USING btree ("client_guid");--> statement-breakpoint
CREATE INDEX "blueprint_project_idx" ON "blueprint_sheets" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blueprint_sheet_version_idx" ON "blueprint_sheets" USING btree ("project_id","sheet_number","version");--> statement-breakpoint
CREATE INDEX "cp_zone_idx" ON "capture_points" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "cp_coordinates_gist_idx" ON "capture_points" USING gist ("coordinates");--> statement-breakpoint
CREATE INDEX "co_project_idx" ON "change_orders" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "co_number_project_idx" ON "change_orders" USING btree ("project_id","co_number");--> statement-breakpoint
CREATE INDEX "crew_member_user_idx" ON "crew_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equipment_org_idx" ON "equipment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "equipment_project_idx" ON "equipment" USING btree ("current_project_id");--> statement-breakpoint
CREATE INDEX "hotspot_panorama_idx" ON "hotspots" USING btree ("panorama_id");--> statement-breakpoint
CREATE INDEX "note_project_idx" ON "notes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "note_created_by_idx" ON "notes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "invite_org_idx" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_email_org_idx" ON "organization_invitations" USING btree ("email","organization_id");--> statement-breakpoint
CREATE INDEX "org_member_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "panorama_cp_idx" ON "panoramas" USING btree ("capture_point_id");--> statement-breakpoint
CREATE INDEX "pointage_project_date_idx" ON "pointage_records" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "pointage_subcontractor_idx" ON "pointage_records" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX "pm_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_org_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_coordinates_gist_idx" ON "projects" USING gist ("coordinates");--> statement-breakpoint
CREATE INDEX "rfi_project_idx" ON "rfis" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rfi_project_number_idx" ON "rfis" USING btree ("project_id","rfi_number");--> statement-breakpoint
CREATE INDEX "site_log_project_idx" ON "site_daily_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "site_log_date_idx" ON "site_daily_logs" USING btree ("log_date");--> statement-breakpoint
CREATE INDEX "subcontractor_project_idx" ON "subcontractors" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "team_org_idx" ON "teams" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_catalog_name_idx" ON "trade_catalog" USING btree ("name");--> statement-breakpoint
CREATE INDEX "security_log_user_idx" ON "user_security_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_crew_org_idx" ON "work_crews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "work_crew_lead_idx" ON "work_crews" USING btree ("team_lead_id");--> statement-breakpoint
CREATE INDEX "work_crew_project_idx" ON "work_crews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "zone_project_idx" ON "zones" USING btree ("project_id");--> statement-breakpoint
CREATE VIEW "public"."project_health_view" AS (select "projects"."id", "projects"."name", "projects"."organization_id", count(distinct "zones"."id") as "total_zones", count(distinct "panoramas"."id") as "total_captures", count("hotspots"."id") FILTER (WHERE "hotspots"."status" = 'issue') as "open_issues", count("hotspots"."id") FILTER (WHERE "hotspots"."status" = 'resolved') as "resolved_issues" from "projects" left join "zones" on "projects"."id" = "zones"."project_id" left join "capture_points" on "zones"."id" = "capture_points"."zone_id" left join "panoramas" on "capture_points"."id" = "panoramas"."capture_point_id" left join "hotspots" on "panoramas"."id" = "hotspots"."panorama_id" group by "projects"."id");--> statement-breakpoint
CREATE POLICY "Members can view their own organizations" ON "organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = "organizations"."id" 
      AND organization_members.user_id = (select auth.uid())
    ));