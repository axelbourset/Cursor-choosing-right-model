import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { CostAxisKey, MetricKey, ModelRow } from '@schema/snapshot'
import { COST_AXIS_KEYS, METRIC_KEYS } from '@schema/snapshot'
import { selectPlottable, type Filters } from '@domain/selection'
import { buildCostScatterOption } from './costScatterOption'
import { CoverageNote } from '../ui/CoverageNote'
import { CostAxisHelp } from '../ui/CostAxisHelp'

const METRIC_LABELS: Record<MetricKey, string> = {
  intelligence: 'Intelligence',
  coding: 'Coding',
  agentic: 'Agentic',
}

const COST_AXIS_LABELS: Record<CostAxisKey, string> = {
  input: 'Input price',
  output: 'Output price',
  cacheRead: 'Cache read price',
}

type CostScatterChartProps = {
  readonly rows: readonly ModelRow[]
  readonly filters: Filters
  readonly metric: MetricKey
  readonly costAxis: CostAxisKey
  readonly showFrontier: boolean
  readonly onMetricChange: (metric: MetricKey) => void
  readonly onCostAxisChange: (costAxis: CostAxisKey) => void
  readonly onFrontierChange: (show: boolean) => void
}

export function CostScatterChart({
  rows,
  filters,
  metric,
  costAxis,
  showFrontier,
  onMetricChange,
  onCostAxisChange,
  onFrontierChange,
}: CostScatterChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const selection = selectPlottable(rows, metric, filters, costAxis)
  const chartPareto = filters.paretoOnly
    ? {
        frontier: selection.chartRows,
        dominated: [],
        excluded: selection.pareto.excluded,
      }
    : selection.pareto
  const option = buildCostScatterOption(chartPareto, metric, costAxis, showFrontier)

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
      <div className="panel__controls cost-axis-control">
        <label className="cost-axis-control__label" htmlFor="scatter-cost-axis">
          X axis
        </label>
        <select
          id="scatter-cost-axis"
          className="cost-axis-control__select"
          value={costAxis}
          onChange={(event) => onCostAxisChange(event.target.value as CostAxisKey)}
        >
          {COST_AXIS_KEYS.map((key) => (
            <option key={key} value={key}>
              {COST_AXIS_LABELS[key]}
            </option>
          ))}
        </select>
        <CostAxisHelp />
      </div>
      <div className="panel__controls radios" role="radiogroup" aria-label="Scatter Y axis metric">
        <span className="cost-axis-control__label">Y axis</span>
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
