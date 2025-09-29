CREATE TYPE "public"."field_catalog_table" AS ENUM('codes', 'contexts', 'establishments', 'rules');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'boolean', 'date', 'select', 'multiselect');--> statement-breakpoint
CREATE TABLE "billing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_run_id" uuid NOT NULL,
	"record_number" numeric,
	"facture" text,
	"id_ramq" text,
	"date_service" timestamp,
	"debut" text,
	"fin" text,
	"periode" text,
	"lieu_pratique" text,
	"secteur_activite" text,
	"diagnostic" text,
	"code" text,
	"unites" numeric,
	"role" text,
	"element_contexte" text,
	"montant_preliminaire" numeric(10, 2),
	"montant_paye" numeric(10, 2),
	"doctor_info" text,
	"patient" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"place" text,
	"tariff_value" numeric,
	"extra_unit_value" numeric,
	"unit_require" boolean,
	"source_file" text,
	"top_level" text,
	"level1_group" text,
	"level2_group" text,
	"leaf" text,
	"indicators" text,
	"anchor_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text[],
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "contexts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"region" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "establishments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "field_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" "field_catalog_table" NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"type" "field_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" text[],
	"unique_field" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_name" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" numeric NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"condition" jsonb NOT NULL,
	"threshold" numeric,
	"enabled" boolean DEFAULT true NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "rules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_run_id" uuid NOT NULL,
	"rule_id" text,
	"billing_record_id" uuid,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"affected_records" jsonb,
	"rule_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"total_rows" numeric,
	"processed_rows" numeric,
	"error_count" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
