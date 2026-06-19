import { describe, it, expect } from "vitest";
import {
  CryptoError,
  InvalidXpubError,
  WrongNetworkXpubError,
  InvalidXpubChecksumError,
  MalformedXpubError,
  WrongXpubVersionError,
  WrongBip86DepthError,
  InvalidTicketIdError,
  MalformedAddressError,
  InvalidAmountError,
  EmptyContentError,
  ContentTooLongError,
} from "../../src/errors.js";

describe("errores crypto", () => {
  it("CryptoError guarda message", () => {
    const err = new CryptoError("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("CryptoError");
  });

  it("todas las subclases extienden CryptoError", () => {
    expect(new InvalidXpubError("x")).toBeInstanceOf(CryptoError);
    expect(new WrongNetworkXpubError("x")).toBeInstanceOf(CryptoError);
    expect(new InvalidXpubChecksumError("x")).toBeInstanceOf(CryptoError);
    expect(new MalformedXpubError("x")).toBeInstanceOf(CryptoError);
    expect(new WrongXpubVersionError("x")).toBeInstanceOf(CryptoError);
    expect(new WrongBip86DepthError("x")).toBeInstanceOf(CryptoError);
    expect(new InvalidTicketIdError("x")).toBeInstanceOf(CryptoError);
    expect(new MalformedAddressError("x")).toBeInstanceOf(CryptoError);
    expect(new InvalidAmountError("x")).toBeInstanceOf(CryptoError);
    expect(new EmptyContentError("x")).toBeInstanceOf(CryptoError);
    expect(new ContentTooLongError("x")).toBeInstanceOf(CryptoError);
  });

  it("cada subclase tiene su name correcto", () => {
    expect(new InvalidXpubError("x").name).toBe("InvalidXpubError");
    expect(new WrongNetworkXpubError("x").name).toBe("WrongNetworkXpubError");
    expect(new WrongBip86DepthError("x").name).toBe("WrongBip86DepthError");
    expect(new InvalidTicketIdError("x").name).toBe("InvalidTicketIdError");
    expect(new MalformedAddressError("x").name).toBe("MalformedAddressError");
    expect(new InvalidAmountError("x").name).toBe("InvalidAmountError");
    expect(new EmptyContentError("x").name).toBe("EmptyContentError");
    expect(new ContentTooLongError("x").name).toBe("ContentTooLongError");
  });
});
