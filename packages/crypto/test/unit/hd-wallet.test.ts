import { describe, it, expect } from "vitest";
import { HdWallet } from "../../src/hd-wallet.js";
import {
  InvalidXpubError,
  WrongNetworkXpubError,
  WrongBip86DepthError,
  InvalidTicketIdError,
} from "../../src/errors.js";

// XPUB BIP86 oficial de test (m/86'/0'/0')
const VALID_XPUB =
  "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";

describe("HdWallet — derivación BIP86 (vectores oficiales)", () => {
  it("índice 0 produce la dirección BIP86 oficial", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = wallet.deriveAddress(0);
    expect(result.address).toBe(
      "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
    );
    expect(result.path).toBe("m/86'/0'/0'/0/0");
    expect(result.index).toBe(0);
  });

  it("índice 1 produce la dirección BIP86 oficial", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = wallet.deriveAddress(1);
    expect(result.address).toBe(
      "bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh",
    );
    expect(result.path).toBe("m/86'/0'/0'/0/1");
  });

  it("índice 2 produce la dirección BIP86 oficial", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = wallet.deriveAddress(2);
    expect(result.address).toBe(
      "bc1p0d0rhyynq0awa9m8cqrcr8f5nxqx3aw29w4ru5u9my3h0sfygnzs9khxz8",
    );
    expect(result.path).toBe("m/86'/0'/0'/0/2");
  });

  it("determinismo: misma combinación xpub+index produce misma dirección", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const a = wallet.deriveAddress(1);
    const b = wallet.deriveAddress(1);
    expect(a.address).toBe(b.address);
  });

  it("índices distintos producen direcciones distintas", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const a = wallet.deriveAddress(1);
    const b = wallet.deriveAddress(2);
    expect(a.address).not.toBe(b.address);
  });

  it("lanza InvalidTicketIdError si ticketId es negativo", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    expect(() => wallet.deriveAddress(-1)).toThrow(InvalidTicketIdError);
    // Nota: ticketId=0 es válido (compatibilidad BIP86); en producción los
    // tickets BIGSERIAL empiezan en 1, pero eso es responsabilidad del backend.
  });

  it("lanza InvalidTicketIdError si ticketId > 2^31-1", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    expect(() => wallet.deriveAddress(0x80000000)).toThrow(InvalidTicketIdError);
  });

  it("lanza InvalidTicketIdError si ticketId no es entero", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    expect(() => wallet.deriveAddress(1.5)).toThrow(InvalidTicketIdError);
  });
});

describe("HdWallet — validación XPUB", () => {
  it("acepta un XPUB BIP86 válido sin error", () => {
    expect(() => new HdWallet({ xpub: VALID_XPUB })).not.toThrow();
  });

  it("lanza InvalidXpubError si xpub no es string", () => {
    expect(() => new HdWallet({ xpub: undefined as unknown as string })).toThrow(
      InvalidXpubError,
    );
  });

  it("lanza WrongNetworkXpubError si empieza con tpub", () => {
    expect(() => new HdWallet({ xpub: "tpubNotRealButStartsWithTPub" })).toThrow(
      WrongNetworkXpubError,
    );
  });

  it("lanza WrongNetworkXpubError si no empieza con xpub ni tpub", () => {
    expect(() => new HdWallet({ xpub: "ypubSomeOtherPrefix..." })).toThrow(
      WrongNetworkXpubError,
    );
  });

  it("lanza InvalidXpubError si el checksum base58check falla", () => {
    const broken = VALID_XPUB.slice(0, -1) + (VALID_XPUB.slice(-1) === "Q" ? "R" : "Q");
    expect(() => new HdWallet({ xpub: broken })).toThrow(InvalidXpubError);
  });

  it("lanza InvalidXpubError si está truncado", () => {
    expect(() => new HdWallet({ xpub: "xpub6BgBgsespWvERF3LHQu6Cnqd" })).toThrow(
      InvalidXpubError,
    );
  });

  it("lanza WrongBip86DepthError si depth != 3", () => {
    // xpub a nivel m/0' tiene depth=1 (derivado del mnemonic BIP39 test "abandon...about")
    const depth1Xpub =
      "xpub68jrRzQopSUQm76hJ6TNtiJMJfhj38u1X12xCzExrw388hcN443UVnYpswdUkV7vPJ3KayiCdp3Q5E23s4wvkucohVTh7eSstJdBFyn2DMx";
    expect(() => new HdWallet({ xpub: depth1Xpub })).toThrow(WrongBip86DepthError);
  });
});
