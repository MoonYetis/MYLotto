import { sha256 } from "@noble/hashes/sha2";

/**
 * PRNG determinista basado en SHA-256 en modo contador.
 *
 * Stream infinito de bytes: block(i) = SHA256(seed || uint32LE(i)).
 * Dada la misma semilla, produce siempre la misma secuencia de números.
 */
export class Sha256CounterPrng {
  private counter = 0;
  private buffer: Uint8Array = new Uint8Array(0);
  private bufferPos = 0;

  constructor(private readonly seed: Uint8Array) {}

  /**
   * Siguiente entero uniforme en [0, maxExclusive).
   * Rejection sampling: descarta valores >= limit para evitar sesgo de módulo.
   */
  randomInt(maxExclusive: number): number {
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    for (;;) {
      const val = this.nextUint32();
      if (val < limit) return val % maxExclusive;
    }
  }

  private nextUint32(): number {
    if (this.bufferPos + 4 > this.buffer.length) {
      this.refill();
    }
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.bufferPos,
      4,
    );
    this.bufferPos += 4;
    return view.getUint32(0, true); // little-endian
  }

  private refill(): void {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, this.counter++, true);
    const input = new Uint8Array(this.seed.length + counterBytes.length);
    input.set(this.seed, 0);
    input.set(counterBytes, this.seed.length);
    this.buffer = sha256(input);
    this.bufferPos = 0;
  }
}
