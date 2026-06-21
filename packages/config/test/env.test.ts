import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  const valid = {
    NODE_ENV: "development",
    FRACTAL_RPC_URL: "http://100.64.0.1:8332",
    FRACTAL_RPC_USER: "moonyetis_rpc",
    FRACTAL_RPC_PASSWORD: "secret",
    FRACTAL_RPC_TIMEOUT_MS: "15000",
    DATABASE_URL: "postgresql://u:p@localhost:5432/myloto",
    PORT: "3000",
    LOG_LEVEL: "info",
    UNISAT_API_KEY: "sk-test-123",
    XPUB_BIP86:
      "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
  } as const;

  it("acepta un env completo y válido", () => {
    const env = loadEnv(valid);
    expect(env.FRACTAL_RPC_URL).toBe("http://100.64.0.1:8332");
    expect(env.FRACTAL_RPC_TIMEOUT_MS).toBe(15000); // coerce number
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("aplica defaults cuando faltan opcionales", () => {
    const env = loadEnv({
      ...valid,
      NODE_ENV: undefined,
      FRACTAL_RPC_TIMEOUT_MS: undefined,
      PORT: undefined,
      LOG_LEVEL: undefined,
    });
    expect(env.NODE_ENV).toBe("development");
    expect(env.FRACTAL_RPC_TIMEOUT_MS).toBe(15000);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("lanza si falta FRACTAL_RPC_PASSWORD", () => {
    expect(() => loadEnv({ ...valid, FRACTAL_RPC_PASSWORD: undefined })).toThrow();
  });

  it("lanza si FRACTAL_RPC_URL no es IP Tailscale (no empieza con http://100.)", () => {
    expect(() => loadEnv({ ...valid, FRACTAL_RPC_URL: "http://192.168.1.1:8332" })).toThrow();
  });

  it("lanza si DATABASE_URL no es URL válida", () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("lanza si LOG_LEVEL no es valor permitido", () => {
    expect(() => loadEnv({ ...valid, LOG_LEVEL: "verbose" })).toThrow();
  });

  it("lanza si NODE_ENV no es valor permitido", () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: "staging" })).toThrow();
  });

  it("acepta XPUB_BIP86 válido (empieza con xpub)", () => {
    const env = loadEnv({
      ...valid,
      XPUB_BIP86:
        "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
    });
    expect(env.XPUB_BIP86).toMatch(/^xpub/);
  });

  it("lanza si XPUB_BIP86 no empieza con xpub", () => {
    expect(() => loadEnv({ ...valid, XPUB_BIP86: "tpub6CPIbm..." })).toThrow();
  });

  it("lanza si XPUB_BIP86 está vacío", () => {
    expect(() => loadEnv({ ...valid, XPUB_BIP86: "" })).toThrow();
  });

  it("acepta UNISAT_API_KEY y BRC20_TICKER", () => {
    const env = loadEnv({
      ...valid,
      UNISAT_API_KEY: "sk-test-123",
      BRC20_TICKER: "Moonyetis",
    });
    expect(env.UNISAT_API_KEY).toBe("sk-test-123");
    expect(env.BRC20_TICKER).toBe("Moonyetis");
  });

  it("aplica defaults UNISAT_BASE_URL, UNISAT_TIMEOUT_MS y BRC20_TICKER", () => {
    const env = loadEnv({
      ...valid,
    });
    expect(env.UNISAT_BASE_URL).toBe("https://open-api-fractal.unisat.io");
    expect(env.UNISAT_TIMEOUT_MS).toBe(15000);
    expect(env.BRC20_TICKER).toBe("Moonyetis");
  });

  it("lanza si UNISAT_API_KEY está vacío", () => {
    expect(() => loadEnv({ ...valid, UNISAT_API_KEY: "" })).toThrow();
  });

  it("acepta TICKET_PRICE_FB y TICKET_DISCOUNT_PRICE_FB", () => {
    const env = loadEnv({
      ...valid,
      TICKET_PRICE_FB: "100",
      TICKET_DISCOUNT_PRICE_FB: "80",
    });
    expect(env.TICKET_PRICE_FB).toBe(100);
    expect(env.TICKET_DISCOUNT_PRICE_FB).toBe(80);
  });

  it("aplica defaults de precios y worker", () => {
    const env = loadEnv({ ...valid });
    expect(env.TICKET_PRICE_FB).toBe(100);
    expect(env.TICKET_DISCOUNT_PRICE_FB).toBe(80);
    expect(env.PAYMENT_CHECK_INTERVAL_MS).toBe(30000);
    expect(env.PAYMENT_MIN_CONFIRMATIONS).toBe(1);
  });

  it("acepta PAYMENT_CHECK_INTERVAL_MS y PAYMENT_MIN_CONFIRMATIONS custom", () => {
    const env = loadEnv({
      ...valid,
      PAYMENT_CHECK_INTERVAL_MS: "5000",
      PAYMENT_MIN_CONFIRMATIONS: "3",
    });
    expect(env.PAYMENT_CHECK_INTERVAL_MS).toBe(5000);
    expect(env.PAYMENT_MIN_CONFIRMATIONS).toBe(3);
  });

  it("XPUB_BIP86 ahora es required (lanza si falta)", () => {
    expect(() => {
      const { XPUB_BIP86, ...sinXpub } = valid;
      void XPUB_BIP86;
      loadEnv(sinXpub);
    }).toThrow();
  });
});
