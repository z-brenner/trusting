/**
 * Brand colour helpers for the public Trust Center.
 *
 * Organisations pick any colour; we still have to meet 4.5:1 contrast. These
 * helpers derive a readable foreground for text placed on the brand colour and
 * a darkened variant of the brand colour that is readable as text on white.
 */

const INK = "#1c1c22";
const WHITE = "#ffffff";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** White when it reads well on the brand colour, otherwise charcoal. */
export function readableOn(brandHex: string) {
  return contrastRatio(WHITE, brandHex) >= 4.5 ? WHITE : INK;
}

/** The brand colour, darkened just enough to be readable as text on white. */
export function readableAsText(brandHex: string) {
  let rgb = hexToRgb(brandHex);
  let hex = brandHex;
  for (let i = 0; i < 24 && contrastRatio(hex, WHITE) < 4.5; i++) {
    rgb = rgb.map((v) => v * 0.9) as [number, number, number];
    hex = rgbToHex(rgb);
  }
  return hex;
}

/** CSS custom properties applied at the root of the public page. */
export function brandVars(primary: string, secondary: string): Record<string, string> {
  return {
    "--brand": primary,
    "--brand-2": secondary,
    "--brand-fg": readableOn(primary),
    "--brand-text": readableAsText(primary),
  };
}
