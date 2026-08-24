import type { EChartsOption } from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'
import { CHART_THEME, type ChartTheme } from './theme'

/** Pure. Rows must already exclude null-metric entries. */
export function buildScoreBarOption(
  rows: readonly ModelRow[],
  metric: MetricKey,
  theme: ChartTheme = CHART_THEME,
): EChartsOption {
  const muted = theme.textMuted
  const barColor = theme.series[0] ?? CHART_THEME.series[0]!
  return {
    grid: { containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: muted } },
      axisTick: { show: false },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: muted, opacity: 0.25 } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((row) => row.cursorName),
      axisLine: { lineStyle: { color: muted } },
      axisTick: { show: false },
      axisLabel: { color: theme.textSecondary },
    },
    series: [
      {
        type: 'bar',
        data: rows.map((row) => row[metric]),
        itemStyle: { color: barColor },
      },
    ],
    labelLayout: { hideOverlap: true },
  }
}
