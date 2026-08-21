CREATE TYPE "public"."attendance_mode" AS ENUM('physical', 'virtual');--> statement-breakpoint
CREATE TYPE "public"."officer_role" AS ENUM('officer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_by" uuid,
	"method" text DEFAULT 'desk' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"officer_id" uuid,
	"action" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"eligibility" text DEFAULT '' NOT NULL,
	"fee_kobo" integer NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"requires_membership_no" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"serial" text NOT NULL,
	"units_awarded" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"event_title" text NOT NULL,
	"theme" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"registration_deadline" timestamp with time zone,
	"venue" text NOT NULL,
	"venue_address" text DEFAULT '' NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"meeting_url" text,
	"meeting_id" text,
	"support_whatsapp" text,
	"contact_email" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "officer_role" DEFAULT 'officer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passcode" text NOT NULL,
	"title" text,
	"surname" text NOT NULL,
	"first_name" text NOT NULL,
	"other_names" text,
	"membership_no" text,
	"esvarbon_no" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"firm" text,
	"town" text,
	"category_id" text NOT NULL,
	"mode" "attendance_mode" NOT NULL,
	"consent_publish" boolean DEFAULT false NOT NULL,
	"amount_kobo" integer NOT NULL,
	"txn_ref" text NOT NULL,
	"paid_at" timestamp with time zone,
	"proof_url" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_officers_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_confirmed_by_officers_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_registration_idx" ON "attendance" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_log" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_serial_idx" ON "certificates" USING btree ("serial");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_registration_idx" ON "certificates" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "officers_email_idx" ON "officers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_passcode_idx" ON "registrations" USING btree ("passcode");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_membership_idx" ON "registrations" USING btree ("membership_no");--> statement-breakpoint
CREATE INDEX "registrations_email_idx" ON "registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "registrations_status_idx" ON "registrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "registrations_txn_idx" ON "registrations" USING btree ("txn_ref");