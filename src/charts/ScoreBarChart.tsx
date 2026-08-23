import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'
import { METRIC_KEYS } from '@schema/snapshot'
import { selectForMetric, type Filters } from '@domain/selection'
import { buildScoreBarOption } from './scoreBarOption'
import { CoverageNote } from '../ui/CoverageNote'

const METRIC_LABELS: Record<MetricKey, string> = {
  intelligence: 'Intelligence',
  coding: 'Coding',
  agentic: 'Agentic',
}

type ScoreBarChartProps = {
  readonly rows: readonly ModelRow[]
  readonly filters: Filters
  readonly metric: MetricKey
  readonly onMetricChange: (metric: MetricKey) => void
}

export function ScoreBarChart({ rows, filters, metric, onMetricChange }: ScoreBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const selection = selectForMetric(rows, metric, filters)
  const option = buildScoreBarOption(selection.visible, metric)

  useEffect(() => {
    const element = chartRef.current
    if (!element) {
      return
    }

    const chart = echarts.init(element)
    chart.setOption(option)

    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [option])

  return (
    <section>
      <div role="tablist" aria-label="Score metric">
        {METRIC_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-pressed={metric === key}
            onClick={() => onMetricChange(key)}
          >
            {METRIC_LABELS[key]}
          </button>
        ))}
      </div>
      <CoverageNote shown={selection.shown} total={selection.total} />
      <div ref={chartRef} data-testid="score-bar-chart" />
    </section>
  )
}
