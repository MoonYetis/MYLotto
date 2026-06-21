import { describe, it, expect } from "vitest";
import { classifyTicket } from "../../src/tiers.js";
import type { CombinacionGanadora } from "@myloto/types";

const GANADORA: CombinacionGanadora = {
  balotas: [10, 20, 30, 40, 50],
  powerball: 5,
};

describe("classifyTicket", () => {
  it("tier 1: 5 balotas + powerball (jackpot)", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 50], powerball: 5 }, GANADORA);
    expect(t).toBe(1);
  });

  it("tier 2: 5 balotas sin powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 50], powerball: 9 }, GANADORA);
    expect(t).toBe(2);
  });

  it("tier 3: 4 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(3);
  });

  it("tier 4: 4 balotas sin powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 60], powerball: 9 }, GANADORA);
    expect(t).toBe(4);
  });

  it("tier 5: 3 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 45, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(5);
  });

  it("tier 6: 3 balotas sin powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 45, 60], powerball: 9 }, GANADORA);
    expect(t).toBe(6);
  });

  it("tier 7: 2 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 35, 45, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(7);
  });

  it("tier 8: 1 balota + powerball", () => {
    const t = classifyTicket({ balotas: [10, 25, 35, 45, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(8);
  });

  it("tier 9: 0 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [11, 22, 33, 44, 55], powerball: 5 }, GANADORA);
    expect(t).toBe(9);
  });

  it("tier 0: sin premio (0 balotas, powerball incorrecto)", () => {
    const t = classifyTicket({ balotas: [11, 22, 33, 44, 55], powerball: 9 }, GANADORA);
    expect(t).toBe(0);
  });
});
