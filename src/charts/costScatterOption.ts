import type { EChartsOption } from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'
import type { ParetoResult } from '@domain/pareto'
import { isOnFrontier } from '@domain/pareto'
import { CHART_THEME, type ChartTheme } from './theme'
import { colorForProvider } from './providerColors'

const DOMINATED_OPACITY = 0.5
const FRONTIER_SYMBOL_SIZE = 16
const DOMINATED_SYMBOL_SIZE = 12

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

function scatterPoint(
  row: ModelRow,
  metric: MetricKey,
  pareto: ParetoResult,
  color: string,
): ScatterPoint {
  const frontier = isOnFrontier(row, pareto)
  return {
    value: [row.priceInput as number, row[metric] as number],
    name: row.cursorName,
    row,
    itemStyle: {
      color,
      opacity: frontier ? 1 : DOMINATED_OPACITY,
      borderColor: frontier ? '#ffffff' : color,
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
  showFrontier: boolean,
  theme: ChartTheme = CHART_THEME,
): EChartsOption {
  const plottable = [...pareto.frontier, ...pareto.dominated]
  const providers = [...new Set(plottable.map((row) => row.provider))].sort()
  const muted = theme.textMuted

  const series: EChartsOption['series'] = providers.map((provider) => {
    const color = colorForProvider(provider, theme)
    const data = plottable
      .filter((row) => row.provider === provider)
      .map((row) => scatterPoint(row, metric, pareto, color))

    return {
      name: provider,
      type: 'scatter',
      data,
      itemStyle: { color },
      emphasis: { focus: 'self' },
      cursor: 'pointer',
    }
  })

  if (showFrontier && pareto.frontier.length > 0) {
    const frontierData = pareto.frontier.map((row) => [
      row.priceInput as number,
      row[metric] as number,
    ])
    ;(series as Array<Record<string, unknown>>).push({
      name: 'Pareto frontier',
      type: 'line',
      data: frontierData,
      showSymbol: false,
      lineStyle: { width: 2, color: muted, opacity: 0.55 },
      tooltip: { show: false },
      legendHoverLink: false,
      silent: true,
      z: 0,
    })
  }

  const legendData =
    showFrontier && pareto.frontier.length > 0 ? [...providers, 'Pareto frontier'] : providers

  return {
    grid: { containLabel: true, bottom: providers.length > 6 ? 56 : 40 },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: '#010409',
      borderColor: theme.border,
      textStyle: { color: theme.textPrimary, fontSize: 12 },
      formatter: (params: unknown) => {
        const point = (params as { data?: ScatterPoint }).data
        if (!point?.row) {
          return ''
        }
        const row = point.row
        return [
          `<strong>${row.cursorName}</strong>`,
          row.provider,
          `Input: <b>$${row.priceInput}</b> / 1M tokens`,
          `Intelligence: <b>${fmtScore(row.intelligence)}</b> · Coding: <b>${fmtScore(row.coding)}</b> · Agentic: <b>${fmtScore(row.agentic)}</b>`,
        ].join('<br/>')
      },
    },
    legend: {
      show: providers.length > 0,
      type: 'scroll',
      bottom: 0,
      data: legendData,
      textStyle: { color: theme.textSecondary },
    },
    xAxis: {
      type: 'log',
      name: 'Price per 1M input tokens (USD, log scale)',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: muted },
      axisLine: { lineStyle: { color: muted } },
      axisTick: { show: false },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: muted, opacity: 0.25 } },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: muted } },
      axisTick: { show: false },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: muted, opacity: 0.25 } },
    },
    series,
  }
}
