import { encode } from "uqr";
import { EmptyContentError, ContentTooLongError } from "./errors.js";

export interface QrSvgOptions {
  /** Tamaño en píxeles del SVG resultante. Default: 256. */
  size?: number;
  /** Color de los módulos oscuros. Default: "#000000". */
  darkColor?: string;
  /** Color de los módulos claros (fondo). Default: "#ffffff". */
  lightColor?: string;
  /** Margen (quiet zone) en módulos. Default: 4 (especificación QR). */
  margin?: number;
}

/** Capacidad máxima de QR v40 nivel L (bytes alfanuméricos). */
const MAX_QR_BYTES = 2953;

/**
 * Renderiza un string como código QR en formato SVG string.
 * Usa uqr para la matriz de módulos y construye el SVG con paths optimizados
 * (un path por run horizontal de módulos oscuros, no un rect por módulo).
 *
 * @param content Texto a codificar (típicamente un URI BIP21).
 * @throws EmptyContentError si content es vacío.
 * @throws ContentTooLongError si content excede la capacidad del QR.
 */
export function renderQrSvg(content: string, opts: QrSvgOptions = {}): string {
  if (content.length === 0) {
    throw new EmptyContentError("content no puede ser vacío");
  }
  const byteLength = Buffer.byteLength(content, "utf8");
  if (byteLength > MAX_QR_BYTES) {
    throw new ContentTooLongError(
      `content excede capacidad QR (${byteLength} > ${MAX_QR_BYTES} bytes)`,
    );
  }

  const size = opts.size ?? 256;
  const darkColor = opts.darkColor ?? "#000000";
  const lightColor = opts.lightColor ?? "#ffffff";
  const margin = opts.margin ?? 4;

  const { data, size: moduleCount } = encode(content, { ecl: "medium" });

  const totalModules = moduleCount + margin * 2;
  const moduleSize = size / totalModules;

  // data es boolean[][] (matriz NxN): data[row][col] === true → módulo oscuro.
  // Construimos un path por runs horizontales de módulos oscuros contiguos.
  let pathData = "";
  for (let row = 0; row < moduleCount; row++) {
    const rowArr = data[row];
    if (!rowArr) continue;
    let runStart = -1;
    for (let col = 0; col <= moduleCount; col++) {
      const isDark = col < moduleCount && rowArr[col] === true;
      if (isDark && runStart === -1) {
        runStart = col;
      } else if (!isDark && runStart !== -1) {
        const x = (runStart + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        const w = (col - runStart) * moduleSize;
        const h = moduleSize;
        pathData += `M${x.toFixed(2)},${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}z`;
        runStart = -1;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${lightColor}"/>
  <path fill="${darkColor}" d="${pathData}"/>
</svg>`;
}
