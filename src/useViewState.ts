import { useCallback, useState } from 'react'
import type { CostAxisKey, MetricKey } from '@schema/snapshot'
import { DEFAULT_FILTERS, type Filters } from '@domain/selection'

/** The user's current view: which metric, cost axis, filters and toggles. */
export type ViewState = {
  readonly filters: Filters
  readonly metric: MetricKey
  readonly costAxis: CostAxisKey
  readonly showFrontier: boolean
  /** Price models as Teams and Enterprise plans pay, with Cursor's Token Rate added. */
  readonly includeCursorTokenRate: boolean
}

const INITIAL_STATE: ViewState = {
  filters: DEFAULT_FILTERS,
  metric: 'intelligence',
  costAxis: 'input',
  showFrontier: true,
  includeCursorTokenRate: true,
}

/** Holds `ViewState` and merges partial updates into it. */
export function useViewState(): {
  readonly state: ViewState
  readonly set: (patch: Partial<ViewState>) => void
} {
  const [state, setState] = useState<ViewState>(INITIAL_STATE)

  const set = useCallback((patch: Partial<ViewState>) => {
    setState((previous) => ({ ...previous, ...patch }))
  }, [])

  return { state, set }
}
