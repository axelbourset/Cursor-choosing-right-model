import type { EChartsOption } from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'

/** Pure. Rows must already exclude null-metric entries. */
export function buildScoreBarOption(rows: readonly ModelRow[], metric: MetricKey): EChartsOption {
  return {
    grid: { containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: rows.map((row) => row.cursorName),
    },
    series: [
      {
        type: 'bar',
        data: rows.map((row) => row[metric]),
      },
    ],
    labelLayout: { hideOverlap: true },
  }
}
