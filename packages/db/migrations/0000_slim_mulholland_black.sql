CREATE TABLE IF NOT EXISTS "sorteos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bloque_cierre" integer NOT NULL,
	"estado" text DEFAULT 'ABIERTO' NOT NULL,
	"combinacion_ganadora" jsonb,
	"seed_maestra" text,
	"bloques_semilla" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrado_en" timestamp with time zone,
	"calculado_en" timestamp with time zone,
	CONSTRAINT "chk_sorteo_estado" CHECK ("sorteos"."estado" IN ('ABIERTO', 'CERRADO', 'CALCULADO'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sorteo_id" bigserial NOT NULL,
	"payment_address" text NOT NULL,
	"expected_amount" numeric(18, 8) NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"n1" smallint NOT NULL,
	"n2" smallint NOT NULL,
	"n3" smallint NOT NULL,
	"n4" smallint NOT NULL,
	"n5" smallint NOT NULL,
	"powerball" smallint NOT NULL,
	"user_return_address" text,
	"recibido_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ticket_status" CHECK ("tickets"."status" IN ('PENDIENTE', 'ACTIVO')),
	CONSTRAINT "chk_balotas_sorted" CHECK ("tickets"."n1" < "tickets"."n2" AND "tickets"."n2" < "tickets"."n3" AND "tickets"."n3" < "tickets"."n4" AND "tickets"."n4" < "tickets"."n5"),
	CONSTRAINT "chk_balotas_range" CHECK ("tickets"."n1" BETWEEN 1 AND 69
          AND "tickets"."n2" BETWEEN 1 AND 69
          AND "tickets"."n3" BETWEEN 1 AND 69
          AND "tickets"."n4" BETWEEN 1 AND 69
          AND "tickets"."n5" BETWEEN 1 AND 69),
	CONSTRAINT "chk_powerball_range" CHECK ("tickets"."powerball" BETWEEN 1 AND 26)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sorteo_id_sorteos_id_fk" FOREIGN KEY ("sorteo_id") REFERENCES "public"."sorteos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sorteos_bloque_cierre_unique" ON "sorteos" USING btree ("bloque_cierre");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_sorteo_status" ON "tickets" USING btree ("sorteo_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_payment_address" ON "tickets" USING btree ("payment_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_sorteo_combinacion" ON "tickets" USING btree ("sorteo_id","n1","n2","n3","n4","n5","powerball");