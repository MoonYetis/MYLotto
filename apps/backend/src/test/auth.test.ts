import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, generateNonce } from "../services/auth.js";

describe("JWT", () => {
  const secret = "test-secret-at-least-16-chars-long";

  it("signJwt produce un token verificable", () => {
    const token = signJwt({ address: "bc1qtest123" }, secret, 3600);
    expect(token).toBeTypeOf("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
  });

  it("verifyJwt devuelve el payload para un token válido", () => {
    const token = signJwt({ address: "bc1qtest123" }, secret, 3600);
    const payload = verifyJwt(token, secret);
    expect(payload).not.toBeNull();
    expect(payload!.address).toBe("bc1qtest123");
  });

  it("verifyJwt devuelve null para un token inválido", () => {
    const payload = verifyJwt("invalid.token.here", secret);
    expect(payload).toBeNull();
  });

  it("verifyJwt devuelve null para un secreto incorrecto", () => {
    const token = signJwt({ address: "bc1qtest123" }, secret, 3600);
    const payload = verifyJwt(token, "wrong-secret-also-16-chars");
    expect(payload).toBeNull();
  });
});

describe("generateNonce", () => {
  it("genera un string aleatorio de 64 chars hex", () => {
    const nonce = generateNonce();
    expect(nonce).toBeTypeOf("string");
    expect(nonce).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(nonce).toMatch(/^[0-9a-f]+$/);
  });

  it("genera nonces diferentes cada vez", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});
