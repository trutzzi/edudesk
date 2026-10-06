// The app's main color is Tailwind's indigo scale, which Tailwind reads from CSS variables. An institution's own
// color replaces the whole scale: the 600 shade is the color itself, lighter shades mix it with white and darker
// ones with black, so every bg-indigo-50 … text-indigo-800 in the app follows it.
const MIX_WITH_WHITE: Record<number, number> = { 50: 8, 100: 16, 200: 30, 300: 48, 400: 70, 500: 88 };
const MIX_WITH_BLACK: Record<number, number> = { 700: 85, 800: 70, 900: 55, 950: 40 };

export function brandShades(color: string): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(MIX_WITH_WHITE).map(([shade, percent]) => [
        `--color-indigo-${shade}`,
        `color-mix(in oklab, ${color} ${percent}%, white)`,
      ]),
    ),
    '--color-indigo-600': color,
    ...Object.fromEntries(
      Object.entries(MIX_WITH_BLACK).map(([shade, percent]) => [
        `--color-indigo-${shade}`,
        `color-mix(in oklab, ${color} ${percent}%, black)`,
      ]),
    ),
  };
}

// Puts the shades on the page, or takes them off (back to the default indigo) with null
export function applyBrandColor(color: string | null, root: HTMLElement = document.documentElement) {
  for (const name of Object.keys(brandShades('#000000'))) root.style.removeProperty(name);
  if (!color) return;
  for (const [name, value] of Object.entries(brandShades(color))) root.style.setProperty(name, value);
}
