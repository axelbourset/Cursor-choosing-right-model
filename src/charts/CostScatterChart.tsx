import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { MetricKey, ModelRow } from '@schema/snapshot'
import { METRIC_KEYS } from '@schema/snapshot'
import { selectPlottable, type Filters } from '@domain/selection'
import { buildCostScatterOption } from './costScatterOption'
import { CoverageNote } from '../ui/CoverageNote'

const METRIC_LABELS: Record<MetricKey, string> = {
  intelligence: 'Intelligence',
  coding: 'Coding',
  agentic: 'Agentic',
}

type CostScatterChartProps = {
  readonly rows: readonly ModelRow[]
  readonly filters: Filters
  readonly metric: MetricKey
  readonly showFrontier: boolean
  readonly onMetricChange: (metric: MetricKey) => void
  readonly onFrontierChange: (show: boolean) => void
}

export function CostScatterChart({
  rows,
  filters,
  metric,
  showFrontier,
  onMetricChange,
  onFrontierChange,
}: CostScatterChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const selection = selectPlottable(rows, metric, filters)
  const chartPareto = filters.paretoOnly
    ? {
        frontier: selection.chartRows,
        dominated: [],
        excluded: selection.pareto.excluded,
      }
    : selection.pareto
  const option = buildCostScatterOption(chartPareto, metric, showFrontier)

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
    <section className="panel">
      <div className="panel__controls radios" role="radiogroup" aria-label="Scatter Y axis metric">
        {METRIC_KEYS.map((key) => (
          <label className="radio" key={key}>
            <input
              type="radio"
              name="scatter-metric"
              checked={metric === key}
              onChange={() => onMetricChange(key)}
            />
            {METRIC_LABELS[key]}
          </label>
        ))}
      </div>
      <label className="panel__controls check">
        <input
          type="checkbox"
          checked={showFrontier}
          onChange={(event) => onFrontierChange(event.target.checked)}
        />
        Show Pareto frontier line
      </label>
      <CoverageNote shown={selection.shown} total={selection.total} />
      <p className="panel__legend" data-testid="frontier-legend">
        {selection.pareto.frontier.length}{' '}
        {selection.pareto.frontier.length === 1 ? 'model' : 'models'} on the frontier
        {filters.paretoOnly ? ' · chart and table show frontier only' : ''}
      </p>
      <div className="panel__chart" ref={chartRef} data-testid="cost-scatter-chart" />
    </section>
  )
}
