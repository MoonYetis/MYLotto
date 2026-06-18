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
});
