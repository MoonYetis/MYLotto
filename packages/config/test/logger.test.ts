import { describe, it, expect } from "vitest";
import { createLogger } from "../src/logger.js";

describe("createLogger", () => {
  it("crea un logger con método info", () => {
    const log = createLogger("info", "test");
    expect(typeof log.info).toBe("function");
    expect(typeof log.child).toBe("function");
  });

  it("no lanza al loguear un objeto con password", () => {
    const log = createLogger("info", "test");
    expect(() =>
      log.info("msg", { password: "secret", FRACTAL_RPC_PASSWORD: "secret" }),
    ).not.toThrow();
  });

  it("redacta password del output (síncrono vía write callback)", () => {
    const captured: string[] = [];
    const log = createLogger("info", "test", {
      destination: { write: (chunk: string) => captured.push(chunk) },
    });
    log.info("auth attempt", { password: "supersecret", user: "alice" });
    const output = captured.join("");
    expect(output).not.toContain("supersecret");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("alice");
  });
});
