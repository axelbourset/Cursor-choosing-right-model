import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import type { CostAxisKey, MetricKey, ModelRow } from '@schema/snapshot'
import { COST_AXIS_KEYS, METRIC_KEYS } from '@schema/snapshot'
import { makeParetoResult } from '@domain/pareto'
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
  readonly providers: readonly string[]
  readonly metric: MetricKey
  readonly costAxis: CostAxisKey
  readonly showFrontier: boolean
  readonly onFiltersChange: (filters: Filters) => void
  readonly onMetricChange: (metric: MetricKey) => void
  readonly onCostAxisChange: (costAxis: CostAxisKey) => void
  readonly onFrontierChange: (show: boolean) => void
}

function isCostAxisKey(value: string): value is CostAxisKey {
  return (COST_AXIS_KEYS as readonly string[]).includes(value)
}

export function CostScatterChart({
  rows,
  filters,
  providers,
  metric,
  costAxis,
  showFrontier,
  onFiltersChange,
  onMetricChange,
  onCostAxisChange,
  onFrontierChange,
}: CostScatterChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  const selection = useMemo(
    () => selectPlottable(rows, metric, filters, costAxis),
    [rows, metric, filters, costAxis],
  )

  const option = useMemo(() => {
    const chartPareto = filters.paretoOnly
      ? makeParetoResult({
          frontier: selection.chartRows,
          dominated: [],
          excluded: selection.pareto.excluded,
        })
      : selection.pareto
    return buildCostScatterOption(chartPareto, metric, costAxis, showFrontier)
  }, [selection, filters.paretoOnly, metric, costAxis, showFrontier])

  // Init and dispose exactly once. This used to live in the same effect as setOption, with
  // a freshly-built `option` in its dep array, so every toolbar change tore the chart down
  // and rebuilt it — discarding animation, hover and tooltip state.
  useEffect(() => {
    const element = chartRef.current
    if (!element) {
      return
    }

    const chart = echarts.init(element)
    chartInstance.current = chart

    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartInstance.current = null
    }
  }, [])

  useEffect(() => {
    chartInstance.current?.setOption(option, true)
  }, [option])

  return (
    <section className="panel">
      <div className="panel__toolbar">
        <div className="toolbar-field">
          <label htmlFor="scatter-cost-axis">X axis</label>
          <select
            id="scatter-cost-axis"
            className="toolbar-select"
            value={costAxis}
            onChange={(event) => {
              const value = event.target.value
              if (isCostAxisKey(value)) {
                onCostAxisChange(value)
              }
            }}
          >
            {COST_AXIS_KEYS.map((key) => (
              <option key={key} value={key}>
                {COST_AXIS_LABELS[key]}
              </option>
            ))}
          </select>
          <CostAxisHelp />
        </div>

        <div className="toolbar-field" role="radiogroup" aria-label="Scatter Y axis metric">
          <span>Y axis</span>
          <div className="segmented__track">
            {METRIC_KEYS.map((key) => (
              <label className="segmented__option" key={key}>
                <input
                  type="radio"
                  name="scatter-metric"
                  checked={metric === key}
                  onChange={() => {
                    onMetricChange(key)
                  }}
                />
                {METRIC_LABELS[key]}
              </label>
            ))}
          </div>
        </div>

        <label className="toolbar-field">
          Provider
          <select
            className="toolbar-select"
            aria-label="Provider"
            value={filters.provider ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onFiltersChange({ ...filters, provider: value === '' ? null : value })
            }}
          >
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>

        <div className="toolbar-field">
          <label
            className="check"
            title="Show only Pareto models for the selected metric — best score for each price tier, and no model beats them on both price and score."
          >
            <input
              type="checkbox"
              aria-label="Only Pareto models"
              checked={filters.paretoOnly}
              onChange={(event) => {
                onFiltersChange({ ...filters, paretoOnly: event.target.checked })
              }}
            />
            Only Pareto models
          </label>

          <label className="check" title="Draw a line connecting the Pareto points on the chart.">
            <input
              type="checkbox"
              checked={showFrontier}
              onChange={(event) => {
                onFrontierChange(event.target.checked)
              }}
            />
            Draw Pareto line
          </label>
        </div>
      </div>
      <div className="panel__status">
        <CoverageNote shown={selection.shown} total={selection.total} />
        <p className="panel__legend" data-testid="frontier-legend">
          {selection.pareto.frontier.length}{' '}
          {selection.pareto.frontier.length === 1 ? 'Pareto model' : 'Pareto models'}
          {filters.paretoOnly ? ' · chart and table show Pareto only' : ''}
        </p>
      </div>
      <div className="panel__chart" ref={chartRef} data-testid="cost-scatter-chart" />
    </section>
  )
}
