import { describe, it, expect } from "vitest";
import { distributePool } from "../../src/pool.js";

describe("distributePool", () => {
  it("golden vector: pool 1000 FB + tierCounts conocidos → montos exactos", () => {
    // pool=1000, cada tier tiene 1 ganador, carryover=0
    const result = distributePool(1000, [1, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    // Tier 1: 68% de 1000 = 680
    expect(result.tiers[0]!.tierPool).toBe(680);
    expect(result.tiers[0]!.perWinner).toBe(680);
    // Tier 2: 8% = 80
    expect(result.tiers[1]!.tierPool).toBe(80);
    // Tier 5: 1.6% = 16
    expect(result.tiers[4]!.tierPool).toBe(16);
    // Reserva: 13% = 130
    expect(result.operatorReserve).toBe(130);
    // Sin rollover (todos tienen ganadores)
    expect(result.rolloverToJackpot).toBe(0);
  });

  it("tier 1 sin ganadores → su monto rueda al jackpot", () => {
    const result = distributePool(1000, [0, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    expect(result.tiers[0]!.perWinner).toBe(0);
    expect(result.rolloverToJackpot).toBe(680); // 68% de 1000
  });

  it("jackpot carryover se suma solo al tier 1", () => {
    const result = distributePool(1000, [1, 1, 1, 1, 1, 1, 1, 1, 1], 500);
    // Tier 1 recibe 680 + 500 carryover = 1180
    expect(result.tiers[0]!.tierPool).toBe(1180);
    expect(result.tiers[0]!.perWinner).toBe(1180);
    // Tier 2 NO recibe carryover
    expect(result.tiers[1]!.tierPool).toBe(80);
  });

  it("tier 1 sin ganadores + carryover → ambos ruedan", () => {
    const result = distributePool(1000, [0, 1, 1, 1, 1, 1, 1, 1, 1], 500);
    // 680 (tier 1) + 500 (carryover) = 1180 rueda
    expect(result.rolloverToJackpot).toBe(1180);
  });

  it("tier 4 sin ganadores → solo tier 4 rueda", () => {
    const result = distributePool(1000, [1, 1, 1, 0, 1, 1, 1, 1, 1], 0);
    // Tier 4 = 1% de 1000 = 10 rueda
    expect(result.rolloverToJackpot).toBe(10);
    // Tier 1 NO rueda (tiene ganador)
    expect(result.tiers[0]!.perWinner).toBe(680);
  });

  it("reserva operador = 13% exacto", () => {
    const result = distributePool(5000, [1, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    expect(result.operatorReserve).toBe(650); // 13% de 5000
  });

  it("tier con 2 ganadores → perWinner = tierPool / 2", () => {
    const result = distributePool(1000, [2, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    expect(result.tiers[0]!.winnerCount).toBe(2);
    expect(result.tiers[0]!.perWinner).toBe(340); // 680 / 2
  });
});
