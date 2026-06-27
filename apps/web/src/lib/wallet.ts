/**
 * Conector de wallet Bitcoin (UniSat / Xverse / OYL).
 * Usa los providers que las extensiones inyectan en window.
 */

declare global {
  interface Window {
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      signMessage: (message: string) => Promise<string>;
    };
    bitcoin?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

/** Detecta si hay una wallet instalada. */
export function hasWallet(): boolean {
  return typeof window !== "undefined" && (!!window.unisat || !!window.bitcoin);
}

/**
 * Conecta la wallet y devuelve la address del usuario.
 * Prioriza UniSat, luego Xverse/OYL (window.bitcoin).
 */
export async function connectWallet(): Promise<string> {
  if (window.unisat) {
    const accounts = await window.unisat.requestAccounts();
    if (!accounts[0]) throw new Error("No se obtuvo dirección de UniSat");
    return accounts[0];
  }
  if (window.bitcoin) {
    const result = await window.bitcoin.request({
      method: "connect",
      params: [{ purposes: ["payment"] }],
    });
    const address = (result as { addresses?: { address: string }[] })?.addresses?.[0]?.address;
    if (!address) throw new Error("No se obtuvo dirección de la wallet");
    return address;
  }
  throw new Error("No se encontró wallet. Instala UniSat o Xverse.");
}

/**
 * Pide a la wallet firmar un mensaje (BIP-322).
 */
export async function signMessage(address: string, message: string): Promise<string> {
  if (window.unisat) {
    return window.unisat.signMessage(message);
  }
  if (window.bitcoin) {
    const result = await window.bitcoin.request({
      method: "signMessage",
      params: [{ address, message }],
    });
    const signature = (result as { signature?: string })?.signature;
    if (!signature) throw new Error("No se obtuvo firma");
    return signature;
  }
  throw new Error("No se encontró wallet para firmar.");
}
