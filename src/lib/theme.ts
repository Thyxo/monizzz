export const DEFAULT_ACCENT = '#10b981';
export const DEFAULT_BG = '#0a0a0a';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.5;
}

/** Same colour with an alpha, for tinted backgrounds. */
export function tint(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Derives the app's CSS variables from the user's two theme colours and sets
 * them on <html>, so portalled sheets and the login screen get them too.
 */
export function applyTheme(accent = DEFAULT_ACCENT, bg = DEFAULT_BG) {
  const dark = isDark(bg);
  const a = hexToRgb(accent);
  const b = hexToRgb(bg);
  // Opaque surface for sheets: the background nudged towards white/black.
  const lift = (c: number) => Math.round(dark ? c + (255 - c) * 0.09 : c * 0.97 + 255 * 0.03);
  const vars: Record<string, string> = {
    '--accent': accent,
    '--accent-fg': luminance(accent) > 0.6 ? '#000000' : '#ffffff',
    '--accent-rgb': `${a.r}, ${a.g}, ${a.b}`,
    '--bg': bg,
    '--bg-rgb': `${b.r}, ${b.g}, ${b.b}`,
    '--fg': dark ? '#f1f5f9' : '#0f172a',
    '--fg-muted': dark ? '#94a3b8' : '#64748b',
    '--card': dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    '--border': dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    '--sheet': dark ? `rgb(${lift(b.r)}, ${lift(b.g)}, ${lift(b.b)})` : '#ffffff',
    '--color-scheme': dark ? 'dark' : 'light',
  };
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}
