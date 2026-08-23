import type { EChartsOption } from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'
import type { ParetoResult } from '@domain/pareto'

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
): EChartsOption {
  const frontierData = pareto.frontier.map((row) => toScatterPoint(row, metric))
  const dominatedData = pareto.dominated.map((row) => toScatterPoint(row, metric))

  const series: EChartsOption['series'] = [
    {
      name: 'Frontier',
      type: 'scatter',
      data: frontierData,
      itemStyle: { opacity: FRONTIER_OPACITY },
    },
    {
      name: 'Dominated',
      type: 'scatter',
      data: dominatedData,
      itemStyle: { opacity: DOMINATED_OPACITY },
    },
  ]

  if (showFrontier && frontierData.length > 0) {
    ;(series as Array<Record<string, unknown>>).push({
      type: 'line',
      data: frontierData,
      showSymbol: false,
      lineStyle: { width: 2 },
    })
  }

  return {
    grid: { containLabel: true },
    xAxis: { type: 'log', name: '$/task' },
    yAxis: { type: 'value' },
    series,
  }
}
