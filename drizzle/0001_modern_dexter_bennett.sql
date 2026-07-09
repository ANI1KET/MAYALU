DROP INDEX IF EXISTS "attr_opts_attribute_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attr_opts_attribute_value_idx" ON "attribute_options" ("attribute_id","value");