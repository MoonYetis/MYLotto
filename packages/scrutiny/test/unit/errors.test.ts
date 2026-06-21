import { describe, it, expect } from "vitest";
import { ScrutinyError } from "../../src/errors.js";

describe("errores scrutiny", () => {
  it("ScrutinyError guarda message", () => {
    const err = new ScrutinyError("bad tier");
    expect(err.message).toBe("bad tier");
    expect(err.name).toBe("ScrutinyError");
  });
});
