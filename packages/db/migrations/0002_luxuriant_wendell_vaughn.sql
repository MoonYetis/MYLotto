CREATE TABLE IF NOT EXISTS "wallet_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"nonce" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "wallet_address" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_sessions_address" ON "wallet_sessions" USING btree ("address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_wallet_address" ON "tickets" USING btree ("wallet_address","sorteo_id");