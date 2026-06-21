/**
 * Jerarquía de errores del motor de aleatoriedad.
 */
export class RandomnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RandomnessError";
  }
}

/** Reservada para futuras validaciones (ej. hashes malformados). */
export class InvalidSeedError extends RandomnessError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSeedError";
  }
}
