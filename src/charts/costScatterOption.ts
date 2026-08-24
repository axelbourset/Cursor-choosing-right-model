import type { EChartsOption } from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'
import type { ParetoResult } from '@domain/pareto'
import { CHART_THEME, type ChartTheme } from './theme'

const FRONTIER_OPACITY = 1
const DOMINATED_OPACITY = 0.35

function toScatterPoint(row: ModelRow, metric: MetricKey): [number, number] {
  return [row.aaCostPerTask as number, row[metric] as number]
}

/** Pure. Receives a pre-computed `ParetoResult` — does not decide membership. */
export function buildCostScatterOption(
  pareto: ParetoResult,
  metric: MetricKey,
  showFrontier: boolean,
  theme: ChartTheme = CHART_THEME,
): EChartsOption {
  const frontierData = pareto.frontier.map((row) => toScatterPoint(row, metric))
  const dominatedData = pareto.dominated.map((row) => toScatterPoint(row, metric))
  const muted = theme.textMuted
  const frontierColor = theme.series[0] ?? CHART_THEME.series[0]!
  const dominatedColor = theme.series[1] ?? CHART_THEME.series[1]!

  const series: EChartsOption['series'] = [
    {
      name: 'Frontier',
      type: 'scatter',
      data: frontierData,
      itemStyle: { color: frontierColor, opacity: FRONTIER_OPACITY },
    },
    {
      name: 'Dominated',
      type: 'scatter',
      data: dominatedData,
      itemStyle: { color: dominatedColor, opacity: DOMINATED_OPACITY },
    },
  ]

  if (showFrontier && frontierData.length > 0) {
    ;(series as Array<Record<string, unknown>>).push({
      type: 'line',
      data: frontierData,
      showSymbol: false,
      lineStyle: { width: 2, color: frontierColor, opacity: 0.6 },
    })
  }

  return {
    grid: { containLabel: true },
    legend: {
      show: true,
      data: ['Frontier', 'Dominated'],
      textStyle: { color: theme.textSecondary },
    },
    xAxis: {
      type: 'log',
      name: '$/task',
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
