import { describe, it, expect } from "vitest";
import { config } from "dotenv";
import { HdWallet, generateTicketPayment } from "../../src/index.js";

config({ path: "../../.env" });

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)("HdWallet — integración con XPUB real", () => {
  const xpub = process.env.XPUB_BIP86;

  it("el XPUB real pasa validación exhaustiva", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    expect(() => new HdWallet({ xpub })).not.toThrow();
  });

  it("deriva una dirección bc1p válida de 62 chars para ticketId 1", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const result = wallet.deriveAddress(1);
    expect(result.address).toMatch(/^bc1p/);
    expect(result.address).toHaveLength(62);
    expect(result.path).toBe("m/86'/0'/0'/0/1");
    console.log("    Dirección del ticket #1:", result.address);
  });

  it("deriva una dirección bc1p distinta para ticketId 2", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const r1 = wallet.deriveAddress(1);
    const r2 = wallet.deriveAddress(2);
    expect(r1.address).not.toBe(r2.address);
    console.log("    Dirección del ticket #2:", r2.address);
  });

  it("determinismo: mismo ticketId produce misma dirección", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const a = wallet.deriveAddress(5);
    const b = wallet.deriveAddress(5);
    expect(a.address).toBe(b.address);
  });

  it("generateTicketPayment produce address + BIP21 + QR válidos", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const result = generateTicketPayment({
      wallet,
      ticketId: 10,
      amountMb: 0.001,
    });
    expect(result.address).toMatch(/^bc1p/);
    expect(result.bip21Uri).toContain("bitcoin:bc1p");
    expect(result.bip21Uri).toContain("amount=0.001");
    expect(result.qrSvg).toContain("<svg");
    expect(result.qrSvg).toContain("</svg>");
    console.log("    BIP21:", result.bip21Uri);
    console.log("    QR length:", result.qrSvg.length, "bytes");
  });
});
