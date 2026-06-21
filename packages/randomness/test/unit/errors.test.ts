import { describe, it, expect } from "vitest";
import { RandomnessError, InvalidSeedError } from "../../src/errors.js";

describe("errores randomness", () => {
  it("RandomnessError guarda message", () => {
    const err = new RandomnessError("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("RandomnessError");
  });

  it("InvalidSeedError extiende RandomnessError", () => {
    const err = new InvalidSeedError("bad seed");
    expect(err).toBeInstanceOf(RandomnessError);
    expect(err.message).toBe("bad seed");
    expect(err.name).toBe("InvalidSeedError");
  });
});
