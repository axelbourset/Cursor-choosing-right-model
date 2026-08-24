import { useCallback, useState } from 'react'
import type { CostAxisKey, MetricKey } from '@schema/snapshot'
import { DEFAULT_FILTERS, type Filters } from '@domain/selection'

export type ViewState = {
  readonly filters: Filters
  readonly metric: MetricKey
  readonly costAxis: CostAxisKey
  readonly showFrontier: boolean
}

const INITIAL_STATE: ViewState = {
  filters: DEFAULT_FILTERS,
  metric: 'intelligence',
  costAxis: 'input',
  showFrontier: true,
}

export function useViewState(): { state: ViewState; set: (patch: Partial<ViewState>) => void } {
  const [state, setState] = useState<ViewState>(INITIAL_STATE)

  const set = useCallback((patch: Partial<ViewState>) => {
    setState((previous) => ({ ...previous, ...patch }))
  }, [])

  return { state, set }
}
