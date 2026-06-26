import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(() => true),
}));

import confetti from "canvas-confetti";
import { fireConfetti } from "@/lib/confetti";

describe("fireConfetti", () => {
  beforeEach(() => vi.clearAllMocks());

  it("llama canvas-confetti con colores neon", () => {
    fireConfetti();
    expect(confetti).toHaveBeenCalledTimes(1);
    const call = vi.mocked(confetti).mock.calls[0][0];
    expect(call?.colors).toEqual(["#ec4899", "#22d3ee", "#facc15", "#a78bfa"]);
  });

  it("fullScreen usa particleCount 120 y origin.y 0.6", () => {
    fireConfetti({ fullScreen: true });
    const call = vi.mocked(confetti).mock.calls[0][0];
    expect(call?.particleCount).toBe(120);
    expect(call?.origin).toEqual({ y: 0.6 });
  });

  it("sin fullScreen usa particleCount 60", () => {
    fireConfetti();
    const call = vi.mocked(confetti).mock.calls[0][0];
    expect(call?.particleCount).toBe(60);
  });
});
