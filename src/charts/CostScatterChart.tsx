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
  /** Whether `rows` carry the Cursor Token Rate. App applies it; this only labels it. */
  readonly includeCursorTokenRate: boolean
  /** The rate in USD per 1M tokens, from the snapshot. */
  readonly cursorTokenRate: number
  readonly onFiltersChange: (filters: Filters) => void
  readonly onMetricChange: (metric: MetricKey) => void
  readonly onCostAxisChange: (costAxis: CostAxisKey) => void
  readonly onFrontierChange: (show: boolean) => void
  readonly onCursorTokenRateChange: (include: boolean) => void
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
  includeCursorTokenRate,
  cursorTokenRate,
  onFiltersChange,
  onMetricChange,
  onCostAxisChange,
  onFrontierChange,
  onCursorTokenRateChange,
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
    return buildCostScatterOption(chartPareto, metric, costAxis, showFrontier, {
      appliedTokenRate: includeCursorTokenRate ? cursorTokenRate : null,
    })
  }, [
    selection,
    filters.paretoOnly,
    metric,
    costAxis,
    showFrontier,
    includeCursorTokenRate,
    cursorTokenRate,
  ])

  // Init and dispose exactly once. This used to live in the same effect as setOption, with
  // a freshly-built `option` in its dep array, so every settings change tore the chart down
  // and rebuilt it — discarding animation, hover and tooltip state.
  useEffect(() => {
    const element = chartRef.current
    if (!element) {
      return
    }

    const chart = echarts.init(element)
    chartInstance.current = chart

    // Watches the chart's own box rather than the window: its height follows the settings
    // column beside it, which can change with no window resize (a late web font re-wrapping
    // a label), and a canvas sized once would then leave a gap or overflow the card.
    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
      chart.dispose()
      chartInstance.current = null
    }
  }, [])

  useEffect(() => {
    chartInstance.current?.setOption(option, true)
  }, [option])

  return (
    <section className="panel">
      <div className="panel__main">
        <div className="panel__status" role="status">
          <CoverageNote shown={selection.shown} total={selection.total} />
          <p className="panel__legend" data-testid="frontier-legend">
            {selection.pareto.frontier.length}{' '}
            {selection.pareto.frontier.length === 1 ? 'Pareto model' : 'Pareto models'}
            {filters.paretoOnly ? ' · chart and table show Pareto only' : ''}
          </p>
        </div>
        <div className="panel__chart" ref={chartRef} data-testid="cost-scatter-chart" />
      </div>

      <aside className="chart-controls" aria-label="Chart settings">
        <fieldset className="chart-controls__group">
          <legend className="chart-controls__legend">Axes</legend>
          <div className="chart-controls__body">
            <div className="control" role="radiogroup" aria-label="Scatter Y axis metric">
              <span className="control__label">Y axis</span>
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

            <div className="control">
              <label className="control__label" htmlFor="scatter-cost-axis">
                X axis
              </label>
              <div className="control__row">
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
            </div>
          </div>
        </fieldset>

        <fieldset className="chart-controls__group">
          <legend className="chart-controls__legend">Pricing</legend>
          <div className="chart-controls__body">
            <div className="control">
              <label className="check">
                <input
                  type="checkbox"
                  aria-describedby="token-rate-hint"
                  checked={includeCursorTokenRate}
                  onChange={(event) => {
                    onCursorTokenRateChange(event.target.checked)
                  }}
                />
                Cursor Token Rate (Teams/Enterprise)
              </label>
              <p className="control__hint" id="token-rate-hint">
                Adds ${String(cursorTokenRate)} per 1M tokens to every price of eligible third-party
                models. Untick on an individual plan.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="chart-controls__group">
          <legend className="chart-controls__legend">Filter</legend>
          <div className="chart-controls__body">
            <div className="control">
              <label className="control__label" htmlFor="scatter-provider">
                Provider
              </label>
              <select
                id="scatter-provider"
                className="toolbar-select"
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
            </div>

            <div className="control">
              <label className="check">
                <input
                  type="checkbox"
                  aria-label="Only Pareto models"
                  aria-describedby="pareto-only-hint"
                  checked={filters.paretoOnly}
                  onChange={(event) => {
                    onFiltersChange({ ...filters, paretoOnly: event.target.checked })
                  }}
                />
                Only Pareto models
              </label>
              <p className="control__hint" id="pareto-only-hint">
                No other model is both cheaper and better on the selected metric.
              </p>
            </div>

            <div className="control">
              <label className="check">
                <input
                  type="checkbox"
                  aria-label="Only rate-exempt models"
                  aria-describedby="rate-exempt-hint"
                  checked={filters.tokenRateExemptOnly}
                  onChange={(event) => {
                    onFiltersChange({ ...filters, tokenRateExemptOnly: event.target.checked })
                  }}
                />
                Only rate-exempt models
              </label>
              <p className="control__hint" id="rate-exempt-hint">
                Cursor&apos;s own models (Grok, Composer) and its published exclusion list.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="chart-controls__group">
          <legend className="chart-controls__legend">Display</legend>
          <div className="chart-controls__body">
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
        </fieldset>
      </aside>
    </section>
  )
}
