/**
 * Pure colour maths for palette validation — OkLab distance and WCAG contrast.
 *
 * No DOM, no node APIs: these helpers back the unit tests that enforce the
 * provider palette's separation and contrast floors, so they must run anywhere
 * the tests do. Hex strings in, numbers out.
 */

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) {
    throw new Error(`expected a 6-digit hex string, got "${hex}"`)
  }
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** OkLab coordinates of a hex colour — the perceptual space the palette is built in. */
function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Perceptual distance between two hex colours in OkLab. ~0.04 is barely different. */
export function oklabDistance(hexA: string, hexB: string): number {
  const a = hexToOklab(hexA)
  const b = hexToOklab(hexB)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** WCAG relative luminance of a hex colour, 0–1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/** WCAG contrast ratio between two hex colours, ≥ 1. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
