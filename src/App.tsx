import './styles.css'
import type { Snapshot } from '@schema/snapshot'
import type { SnapshotSource } from './snapshot/loadSnapshot'
import { selectPlottable } from '@domain/selection'
import { CostScatterChart } from './charts/CostScatterChart'
import { SnapshotDropZone } from './snapshot/SnapshotDropZone'
import { useSnapshot } from './snapshot/useSnapshot'
import { ModelTable } from './table/ModelTable'
import { StatStrip } from './ui/StatStrip'
import { useViewState } from './useViewState'

type LoadedInfo = {
  readonly snapshot: Snapshot
  readonly source: SnapshotSource
}

const GENERATED_AT_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Short readable date for the header meta line; the full ISO string stays
 * available as the element's `title` so precision is one hover away. */
function formatGeneratedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : GENERATED_AT_FORMAT.format(date)
}

function Header({
  loaded,
  onReplace,
  onUseLocal,
  onClear,
}: {
  readonly loaded: LoadedInfo | null
  readonly onReplace: (file: File) => void
  readonly onUseLocal: () => void
  readonly onClear: () => void
}) {
  return (
    <header className="site-header">
      <p className="site-header__eyebrow">Benchmarks · Prices · Pareto</p>
      <h1 className="site-header__title">Cursor Model Picker</h1>
      {loaded ? (
        <div className="site-header__meta-row">
          <p
            className="site-header__meta"
            data-testid="generated-at"
            title={loaded.snapshot.generatedAt}
          >
            {formatGeneratedAt(loaded.snapshot.generatedAt)}
          </p>
          <p className="site-header__meta">{loaded.snapshot.models.length} models</p>
          <p className="site-header__meta">AA index v{loaded.snapshot.source.aaIndexVersion}</p>
          <p className="site-header__meta">
            {loaded.source === 'dropped' ? 'dropped file' : 'local file'}
          </p>
          <div className="site-header__actions">
            <label className="site-header__action site-header__action--primary">
              replace
              <input
                type="file"
                accept="application/json"
                aria-label="Replace snapshot file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onReplace(file)
                }}
              />
            </label>
            {loaded.source === 'dropped' ? (
              <button
                className="site-header__action site-header__action--outline"
                type="button"
                onClick={onUseLocal}
              >
                use local file
              </button>
            ) : null}
            <button className="site-header__action" type="button" onClick={onClear}>
              clear data
            </button>
          </div>
        </div>
      ) : null}
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <a href="https://artificialanalysis.ai">Data: Artificial Analysis (artificialanalysis.ai)</a>
    </footer>
  )
}

export default function App() {
  const snapshotHook = useSnapshot()
  const { state, set } = useViewState()

  const okResult = snapshotHook.result.kind === 'ok' ? snapshotHook.result : null
  const rows = okResult?.snapshot.models ?? []
  const providers = [...new Set(rows.map((row) => row.provider))].sort()

  const selection = selectPlottable(rows, state.metric, state.filters, state.costAxis)
  const tableRows = state.filters.paretoOnly ? selection.chartRows : selection.filtered
  return (
    <div className="app-container">
      <Header
        loaded={okResult ? { snapshot: okResult.snapshot, source: okResult.source } : null}
        onReplace={(file) => {
          void snapshotHook.acceptFile(file)
        }}
        onUseLocal={() => {
          void snapshotHook.useLocalFile()
        }}
        onClear={() => {
          void snapshotHook.clear()
        }}
      />
      <SnapshotDropZone
        result={snapshotHook.result}
        lastGood={snapshotHook.lastGood}
        onFile={(file) => {
          void snapshotHook.acceptFile(file)
        }}
      >
        {okResult ? (
          <>
            <StatStrip
              models={rows.length}
              providers={providers.length}
              shown={selection.shown}
              total={selection.total}
              frontier={selection.pareto.frontier.length}
            />
            <CostScatterChart
              rows={rows}
              filters={state.filters}
              providers={providers}
              metric={state.metric}
              costAxis={state.costAxis}
              showFrontier={state.showFrontier}
              onFiltersChange={(filters) => {
                set({ filters })
              }}
              onMetricChange={(metric) => {
                set({ metric })
              }}
              onCostAxisChange={(costAxis) => {
                set({ costAxis })
              }}
              onFrontierChange={(showFrontier) => {
                set({ showFrontier })
              }}
            />
            <div className="table-section-outer">
              <ModelTable rows={tableRows} />
            </div>
            <Footer />
          </>
        ) : null}
      </SnapshotDropZone>
    </div>
  )
}
