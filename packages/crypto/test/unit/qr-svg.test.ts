import { describe, it, expect } from "vitest";
import { renderQrSvg } from "../../src/qr-svg.js";
import { EmptyContentError, ContentTooLongError } from "../../src/errors.js";

describe("renderQrSvg", () => {
  it("genera SVG válido para un string corto", () => {
    const svg = renderQrSvg("hello");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
    expect(svg).toContain("xmlns");
  });

  it("tiene un path o rect oscuro (contenido)", () => {
    const svg = renderQrSvg("hello");
    expect(svg).toMatch(/<(path|rect)[^>]*fill="#000000"/);
  });

  it("tiene un fondo claro rect", () => {
    const svg = renderQrSvg("hello");
    expect(svg).toMatch(/<rect[^>]*fill="#ffffff"/);
  });

  it("respeta size custom", () => {
    const svg = renderQrSvg("hello", { size: 512 });
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="512"');
  });

  it("respeta darkColor y lightColor custom", () => {
    const svg = renderQrSvg("hello", { darkColor: "#ff0000", lightColor: "#eeeeee" });
    expect(svg).toContain("#ff0000");
    expect(svg).toContain("#eeeeee");
  });

  it("lanza EmptyContentError si content es vacío", () => {
    expect(() => renderQrSvg("")).toThrow(EmptyContentError);
  });

  it("lanza ContentTooLongError si content excede 2953 bytes", () => {
    const longContent = "x".repeat(3000);
    expect(() => renderQrSvg(longContent)).toThrow(ContentTooLongError);
  });

  it("codifica un BIP21 URI correctamente", () => {
    const bip21 =
      "bitcoin:bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr?amount=0.001";
    const svg = renderQrSvg(bip21);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg.length).toBeGreaterThan(500);
  });
});
