import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/lifecycle-verifier.js";
import type { Logger } from "@myloto/config";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function makeDeps(
  overrides: Partial<{
    blockCount: number;
    closed: number;
  }> = {},
) {
  return {
    getBlockCount: vi.fn().mockResolvedValue(overrides.blockCount ?? 200),
    cerrarVencidos: vi.fn().mockResolvedValue(overrides.closed ?? 0),
    logger,
  };
}

describe("runRound (lifecycle-verifier)", () => {
  it("cierra sorteos vencidos", async () => {
    const deps = makeDeps({ blockCount: 200, closed: 3 });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 3, closed: 3 });
    expect(deps.cerrarVencidos).toHaveBeenCalledWith(200);
  });

  it("sin vencidos → 0", async () => {
    const deps = makeDeps({ closed: 0 });
    expect(await runRound(deps)).toEqual({ checked: 0, closed: 0 });
  });

  it("error de RPC propaga (runLoop exterior lo captura)", async () => {
    const deps = makeDeps();
    deps.getBlockCount = vi.fn().mockRejectedValue(new Error("rpc down"));
    await expect(runRound(deps)).rejects.toThrow("rpc down");
  });
});
