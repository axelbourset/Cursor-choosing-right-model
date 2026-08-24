import './styles.css'
import type { Snapshot } from '@schema/snapshot'
import { selectPlottable } from '@domain/selection'
import { CostScatterChart } from './charts/CostScatterChart'
import { SnapshotDropZone } from './snapshot/SnapshotDropZone'
import { useSnapshot } from './snapshot/useSnapshot'
import { ModelTable } from './table/ModelTable'
import { FilterBar } from './ui/FilterBar'
import { useViewState } from './useViewState'

function Header({ snapshot }: { readonly snapshot: Snapshot }) {
  return (
    <header className="site-header">
      <h1 className="site-header__title">Cursor Model Picker</h1>
      <p className="site-header__meta" data-testid="generated-at">
        {snapshot.generatedAt}
      </p>
      <p className="site-header__meta">{snapshot.models.length} models</p>
      <p className="site-header__meta">AA index v{snapshot.source.aaIndexVersion}</p>
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

  const selection = selectPlottable(rows, state.metric, state.filters)
  const tableRows = state.filters.paretoOnly ? selection.chartRows : selection.filtered
  return (
    <div className="app-container">
      <p className="masthead">
        <span className="masthead__mark" aria-hidden="true" />
        Cursor Model Picker
      </p>
      <SnapshotDropZone
        result={snapshotHook.result}
        lastGood={snapshotHook.lastGood}
        onFile={(file) => {
          void snapshotHook.acceptFile(file)
        }}
        onUseLocal={() => {
          void snapshotHook.useLocalFile()
        }}
        onClear={() => {
          void snapshotHook.clear()
        }}
      >
        {okResult ? (
          <>
            <Header snapshot={okResult.snapshot} />
            <FilterBar
              filters={state.filters}
              providers={providers}
              onChange={(filters) => {
                set({ filters })
              }}
            />
            <CostScatterChart
              rows={rows}
              filters={state.filters}
              metric={state.metric}
              showFrontier={state.showFrontier}
              onMetricChange={(metric) => {
                set({ metric })
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
