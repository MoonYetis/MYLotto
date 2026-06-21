/** Jerarquía de errores del motor de escrutinio. */
export class ScrutinyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrutinyError";
  }
}
