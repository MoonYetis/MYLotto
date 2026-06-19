import { describe, it, expect } from "vitest";
import { generateTicketPayment, HdWallet } from "../../src/index.js";

const VALID_XPUB =
  "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";

describe("generateTicketPayment", () => {
  it("combina derivación + BIP21 + QR en un objeto", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = generateTicketPayment({
      wallet,
      ticketId: 1,
      amountMb: 0.001,
    });
    expect(result.address).toBe(
      "bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh",
    );
    expect(result.bip21Uri).toBe(`bitcoin:${result.address}?amount=0.001`);
    expect(result.qrSvg).toContain("<svg");
    expect(result.path).toBe("m/86'/0'/0'/0/1");
  });

  it("respeta qrOptions custom", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = generateTicketPayment({
      wallet,
      ticketId: 2,
      amountMb: 1,
      qrOptions: { size: 400 },
    });
    expect(result.qrSvg).toContain('width="400"');
  });
});
