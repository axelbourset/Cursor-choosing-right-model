import type { EChartsOption } from 'echarts'
import type { CostAxisKey, MetricKey, ModelRow } from '@schema/snapshot'
import type { ParetoResult } from '@domain/pareto'
import { isOnFrontier } from '@domain/pareto'
import { toPricedRow, type PricedRow } from '@domain/price'
import { CHART_THEME, type ChartTheme } from './theme'
import { colorForProvider } from './providerColors'

const DOMINATED_OPACITY = 0.5
const FRONTIER_SYMBOL_SIZE = 16
const DOMINATED_SYMBOL_SIZE = 12

const COST_AXIS_LABELS: Record<CostAxisKey, string> = {
  input: 'Price per 1M input tokens (USD, log scale)',
  output: 'Price per 1M output tokens (USD, log scale)',
  cacheRead: 'Price per 1M cache-read tokens (USD, log scale)',
}

type ScatterPoint = {
  readonly value: [number, number]
  readonly name: string
  readonly row: ModelRow
  readonly itemStyle: {
    readonly color: string
    readonly opacity: number
    readonly borderColor: string
    readonly borderWidth: number
  }
  readonly symbolSize: number
  readonly emphasis: {
    readonly scale: number
    readonly focus: 'self'
  }
}

function fmtScore(value: number | null): string {
  return value === null ? '—' : String(Math.round(value * 10) / 10)
}

/** A missing price must render as an em dash, never as the string `null` and never as 0.
 *  `selectPlottable` only guarantees the ACTIVE cost axis is present, so the other two
 *  columns in the tooltip are genuinely nullable. */
function fmtPrice(value: number | null): string {
  return value === null ? '—' : `$${String(value)}`
}

function isScatterPoint(value: unknown): value is ScatterPoint {
  return typeof value === 'object' && value !== null && 'row' in value
}

function scatterPoint(
  priced: PricedRow,
  pareto: ParetoResult,
  color: string,
  theme: ChartTheme,
): ScatterPoint {
  const row = priced.row
  const frontier = isOnFrontier(row, pareto)
  return {
    value: [priced.cost, priced.score],
    name: row.cursorName,
    row,
    // Provider identity lives in the fill colour; frontier membership lives in
    // size plus a white ring. The two encodings are orthogonal, so colour is
    // never asked to carry meaning it cannot hold.
    itemStyle: {
      color,
      opacity: frontier ? 1 : DOMINATED_OPACITY,
      borderColor: frontier ? theme.textPrimary : color,
      borderWidth: frontier ? 1.5 : 0,
    },
    symbolSize: frontier ? FRONTIER_SYMBOL_SIZE : DOMINATED_SYMBOL_SIZE,
    emphasis: {
      scale: 1.35,
      focus: 'self',
    },
  }
}

/** Pure. Receives a pre-computed `ParetoResult` — does not decide membership. */
export function buildCostScatterOption(
  pareto: ParetoResult,
  metric: MetricKey,
  costAxis: CostAxisKey,
  showFrontier: boolean,
  theme: ChartTheme = CHART_THEME,
): EChartsOption {
  // Projected once, here, so a row missing either axis is dropped rather than asserted
  // away. Everything downstream works with numbers that are provably present.
  const plottable = [...pareto.frontier, ...pareto.dominated].flatMap((row) => {
    const priced = toPricedRow(row, metric, costAxis)
    return priced === null ? [] : [priced]
  })
  const providers = [...new Set(plottable.map((priced) => priced.row.provider))].sort()
  const muted = theme.textMuted

  const scatterSeries = providers.map((provider) => {
    const color = colorForProvider(provider)
    const data = plottable
      .filter((priced) => priced.row.provider === provider)
      .map((priced) => scatterPoint(priced, pareto, color, theme))

    return {
      name: provider,
      type: 'scatter' as const,
      data,
      // One mark shape for every provider — identity is colour, not glyph.
      symbol: 'circle' as const,
      itemStyle: { color },
      emphasis: { focus: 'self' as const },
      cursor: 'pointer',
    }
  })

  const frontierPoints = pareto.frontier.flatMap((row) => {
    const priced = toPricedRow(row, metric, costAxis)
    return priced === null ? [] : [[priced.cost, priced.score]]
  })

  const frontierSeries =
    showFrontier && frontierPoints.length > 0
      ? [
          {
            name: 'Pareto',
            type: 'line' as const,
            data: frontierPoints,
            showSymbol: false,
            lineStyle: { width: 2, color: theme.mint },
            tooltip: { show: false },
            legendHoverLink: false,
            silent: true,
            z: 0,
          },
        ]
      : []

  // Built in one expression so the union is inferred, not asserted away: the old
  // `series as Array<Record<string, unknown>>` push disabled checking on this series.
  const series = [...scatterSeries, ...frontierSeries] satisfies EChartsOption['series']

  const legendData = frontierSeries.length > 0 ? [...providers, 'Pareto'] : providers

  return {
    grid: {
      left: 56,
      right: 24,
      top: 28,
      bottom: providers.length > 6 ? 104 : 88,
      containLabel: true,
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: theme.canvas,
      borderColor: theme.mint,
      padding: 12,
      textStyle: { color: theme.textSecondary, fontSize: 12, fontFamily: theme.fontSans },
      extraCssText: 'border-width: 1px;',
      formatter: (params: unknown) => {
        // The line series' data entries are bare [x, y] tuples with no row, so this guard
        // is load-bearing rather than defensive.
        const data = (params as { data?: unknown }).data
        if (!isScatterPoint(data)) {
          return ''
        }
        const row = data.row
        return [
          `<strong style="color:${theme.textPrimary}">${row.cursorName}</strong>`,
          row.provider,
          `Input: <b>${fmtPrice(row.priceInput)}</b> / 1M tokens`,
          `Output: <b>${fmtPrice(row.priceOutput)}</b> / 1M tokens`,
          `Cache read: <b>${fmtPrice(row.priceCacheRead)}</b> / 1M tokens`,
          `Intelligence: <b>${fmtScore(row.intelligence)}</b> · Coding: <b>${fmtScore(row.coding)}</b> · Agentic: <b>${fmtScore(row.agentic)}</b>`,
        ].join('<br/>')
      },
    },
    legend: {
      show: providers.length > 0,
      type: 'scroll',
      bottom: 0,
      data: legendData,
      textStyle: { color: muted, fontSize: 11, fontFamily: theme.fontMono },
      formatter: (name: string) => name.toUpperCase(),
    },
    xAxis: {
      type: 'log',
      name: COST_AXIS_LABELS[costAxis],
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: muted, fontFamily: theme.fontSans },
      axisLine: { lineStyle: { color: muted } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 10, fontFamily: theme.fontMono },
      splitLine: { lineStyle: { color: muted, opacity: 0.2 } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: muted } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 10, fontFamily: theme.fontMono },
      splitLine: { lineStyle: { color: muted, opacity: 0.2 } },
    },
    series,
  }
}
