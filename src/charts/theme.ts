/**
 * Chart theme — the single source of colour for the ECharts option builders.
 *
 * The series hexes are the validated dark categorical palette (D4), duplicated here
 * from `src/tokens.css` because jsdom does not reliably resolve CSS custom
 * properties declared in a stylesheet. Keeping the builders pure (no DOM access)
 * means they take this constant as an explicit argument. `theme.test.ts` asserts
 * the two copies agree so the duplication cannot drift silently.
 *
 * These are the DARK values (the design default). Light mode is a courtesy and is
 * not mirrored into the charts — the chart surface stays dark per the design.
 */

export interface ChartTheme {
  /** D4 categorical palette, slots 1–8. Only 1–3 clear the all-pairs CVD floors. */
  readonly series: readonly string[]
  /** Ink — primary label text. */
  readonly textPrimary: string
  /** Ink — secondary label text. */
  readonly textSecondary: string
  /** Ink — recessive axes/grid. */
  readonly textMuted: string
  /** Edge — chart frame, if ever drawn. */
  readonly border: string
}

export const CHART_THEME: ChartTheme = {
  series: [
    '#3987e5', // 1 blue — frontier / bar
    '#d95926', // 2 orange — dominated
    '#199e70', // 3 aqua — third series if needed
    '#c98500', // 4 yellow — provider chips only
    '#d55181', // 5 magenta — provider chips only
    '#008300', // 6 green — provider chips only
    '#9085e9', // 7 violet — provider chips only
    '#e66767', // 8 red — provider chips only
  ],
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  textMuted: '#8a8a82',
  border: '#3a3a3d',
}
