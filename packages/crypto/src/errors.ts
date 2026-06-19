/**
 * Jerarquía de errores del paquete crypto.
 * Todas las subclases extienden CryptoError para que el backend
 * pueda atraparlas con un solo instanceof check.
 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

// --- Errores de XPUB ---
export class InvalidXpubError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXpubError";
  }
}
export class WrongNetworkXpubError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "WrongNetworkXpubError";
  }
}
export class InvalidXpubChecksumError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXpubChecksumError";
  }
}
export class MalformedXpubError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "MalformedXpubError";
  }
}
export class WrongXpubVersionError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "WrongXpubVersionError";
  }
}
export class WrongBip86DepthError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "WrongBip86DepthError";
  }
}

// --- Errores de ticketId ---
export class InvalidTicketIdError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTicketIdError";
  }
}

// --- Errores de BIP21 ---
export class MalformedAddressError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "MalformedAddressError";
  }
}
export class InvalidAmountError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

// --- Errores de QR ---
export class EmptyContentError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "EmptyContentError";
  }
}
export class ContentTooLongError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "ContentTooLongError";
  }
}
