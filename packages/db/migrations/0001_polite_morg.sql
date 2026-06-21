CREATE TABLE IF NOT EXISTS "ganadores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sorteo_id" bigserial NOT NULL,
	"ticket_id" bigserial NOT NULL,
	"tier" smallint NOT NULL,
	"monto" numeric(18, 8) NOT NULL,
	"pagado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_tier" CHECK ("ganadores"."tier" BETWEEN 1 AND 9)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jackpot_pool" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"saldo" numeric(18, 8) DEFAULT '0' NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_singleton" CHECK ("jackpot_pool"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "sorteos" DROP CONSTRAINT "chk_sorteo_estado";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ganadores" ADD CONSTRAINT "ganadores_sorteo_id_sorteos_id_fk" FOREIGN KEY ("sorteo_id") REFERENCES "public"."sorteos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ganadores" ADD CONSTRAINT "ganadores_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ganadores_sorteo_tier" ON "ganadores" USING btree ("sorteo_id","tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ganadores_ticket" ON "ganadores" USING btree ("ticket_id");--> statement-breakpoint
ALTER TABLE "sorteos" ADD CONSTRAINT "chk_sorteo_estado" CHECK ("sorteos"."estado" IN ('ABIERTO', 'CERRADO', 'CALCULADO', 'FINALIZADO'));--> statement-breakpoint
INSERT INTO "jackpot_pool" ("id", "saldo") VALUES (1, 0) ON CONFLICT DO NOTHING;