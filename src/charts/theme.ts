/**
 * Chart theme — the single source of colour and type for the ECharts option
 * builders.
 *
 * Providers own their identity colours (providerColors.ts); this theme carries
 * everything shared: canvas, ink, hairlines, hazard accents, and the font
 * stacks. The values are duplicated from `src/tokens.css` because jsdom does
 * not reliably resolve CSS custom properties declared in a stylesheet — keeping
 * the builders pure (no DOM access) means they take this constant as an
 * explicit argument. `theme.test.ts` asserts the two copies agree so the
 * duplication cannot drift silently.
 */

export type ChartTheme = {
  /** The chart's page canvas — tooltip fills, anything that must melt into the page. */
  readonly canvas: string
  /** Ink — primary text (tooltip titles, strong values). */
  readonly textPrimary: string
  /** Ink — secondary text (tooltip body). */
  readonly textSecondary: string
  /** Ink — metadata (axis labels, legend, grid). */
  readonly textMuted: string
  /** Quiet 1px frame for recessive structure. */
  readonly border: string
  /** Primary hazard accent — the frontier line. */
  readonly mint: string
  /** Secondary hazard accent. */
  readonly ultraviolet: string
  /** Font stacks, mirrored from tokens.css. */
  readonly fontSans: string
  readonly fontMono: string
}

export const CHART_THEME: ChartTheme = {
  canvas: '#131313',
  textPrimary: '#ffffff',
  textSecondary: '#e9e9e9',
  textMuted: '#949494',
  border: '#313131',
  mint: '#3cffd0',
  ultraviolet: '#5200ff',
  fontSans: "'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif",
  fontMono: "'JetBrains Mono Variable', 'JetBrains Mono', 'Courier New', monospace",
}
