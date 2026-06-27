import {
  pgTable,
  bigserial,
  integer,
  smallint,
  text,
  numeric,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sorteos = pgTable(
  "sorteos",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    bloqueCierre: integer("bloque_cierre").notNull(),
    estado: text("estado").notNull().default("ABIERTO"),
    combinacionGanadora: jsonb("combinacion_ganadora"),
    seedMaestra: text("seed_maestra"),
    bloquesSemilla: jsonb("bloques_semilla"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    calculadoEn: timestamp("calculado_en", { withTimezone: true }),
  },
  (t) => ({
    bloqueCierreUnique: uniqueIndex("sorteos_bloque_cierre_unique").on(t.bloqueCierre),
    estadoCheck: check(
      "chk_sorteo_estado",
      sql`${t.estado} IN ('ABIERTO', 'CERRADO', 'CALCULADO', 'FINALIZADO')`,
    ),
  }),
);

export const tickets = pgTable(
  "tickets",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sorteoId: bigserial("sorteo_id", { mode: "bigint" })
      .notNull()
      .references(() => sorteos.id, { onDelete: "cascade" }),
    paymentAddress: text("payment_address").notNull(),
    expectedAmount: numeric("expected_amount", { precision: 18, scale: 8 }).notNull(),
    status: text("status").notNull().default("PENDIENTE"),
    n1: smallint("n1").notNull(),
    n2: smallint("n2").notNull(),
    n3: smallint("n3").notNull(),
    n4: smallint("n4").notNull(),
    n5: smallint("n5").notNull(),
    powerball: smallint("powerball").notNull(),
    userReturnAddress: text("user_return_address"),
    walletAddress: text("wallet_address"),
    recibidoEn: timestamp("recibido_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sorteoStatusIdx: index("tickets_sorteo_status").on(t.sorteoId, t.status),
    paymentAddressIdx: index("tickets_payment_address").on(t.paymentAddress),
    walletAddressIdx: index("tickets_wallet_address").on(t.walletAddress, t.sorteoId),
    combinacionIdx: index("tickets_sorteo_combinacion").on(
      t.sorteoId,
      t.n1,
      t.n2,
      t.n3,
      t.n4,
      t.n5,
      t.powerball,
    ),
    statusCheck: check("chk_ticket_status", sql`${t.status} IN ('PENDIENTE', 'ACTIVO')`),
    sortedCheck: check(
      "chk_balotas_sorted",
      sql`${t.n1} < ${t.n2} AND ${t.n2} < ${t.n3} AND ${t.n3} < ${t.n4} AND ${t.n4} < ${t.n5}`,
    ),
    rangeCheck: check(
      "chk_balotas_range",
      sql`${t.n1} BETWEEN 1 AND 69
          AND ${t.n2} BETWEEN 1 AND 69
          AND ${t.n3} BETWEEN 1 AND 69
          AND ${t.n4} BETWEEN 1 AND 69
          AND ${t.n5} BETWEEN 1 AND 69`,
    ),
    powerballCheck: check(
      "chk_powerball_range",
      sql`${t.powerball} BETWEEN 1 AND 26`,
    ),
  }),
);

export const ganadores = pgTable(
  "ganadores",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sorteoId: bigserial("sorteo_id", { mode: "bigint" })
      .notNull()
      .references(() => sorteos.id, { onDelete: "cascade" }),
    ticketId: bigserial("ticket_id", { mode: "bigint" })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tier: smallint("tier").notNull(),
    monto: numeric("monto", { precision: 18, scale: 8 }).notNull(),
    pagado: boolean("pagado").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sorteoTierIdx: index("ganadores_sorteo_tier").on(t.sorteoId, t.tier),
    ticketIdx: index("ganadores_ticket").on(t.ticketId),
    tierCheck: check("chk_tier", sql`${t.tier} BETWEEN 1 AND 9`),
  }),
);

export const jackpotPool = pgTable(
  "jackpot_pool",
  {
    id: smallint("id").primaryKey().default(1),
    saldo: numeric("saldo", { precision: 18, scale: 8 }).notNull().default("0"),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    singletonCheck: check("chk_singleton", sql`${t.id} = 1`),
  }),
);

export const walletSessions = pgTable(
  "wallet_sessions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    address: text("address").notNull(),
    nonce: text("nonce").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    addressIdx: index("wallet_sessions_address").on(t.address),
  }),
);

export type Sorteo = typeof sorteos.$inferSelect;
export type NuevoSorteo = typeof sorteos.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NuevoTicket = typeof tickets.$inferInsert;
export type Ganador = typeof ganadores.$inferSelect;
export type NuevoGanador = typeof ganadores.$inferInsert;
export type JackpotPool = typeof jackpotPool.$inferSelect;
