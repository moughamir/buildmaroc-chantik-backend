ALTER TABLE "pointage_records" ADD COLUMN "is_validated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pointage_records" ADD COLUMN "validated_at" timestamp with time zone;