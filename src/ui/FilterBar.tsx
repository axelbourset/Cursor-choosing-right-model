import type { Filters } from '@domain/selection'

export type FilterBarProps = {
  readonly filters: Filters
  readonly providers: readonly string[]
  readonly hiddenCount: number
  readonly onChange: (f: Filters) => void
}

export function FilterBar({ filters, providers, hiddenCount, onChange }: FilterBarProps) {
  const hiddenTitle =
    hiddenCount > 0
      ? `${hiddenCount} model(s) are marked hidden in Cursor’s catalog — not shown in the model picker by default, but still priced and listed here.`
      : 'No hidden models in this snapshot. Hidden models are entries Cursor marks as not shown in the model picker UI.'

  return (
    <div className="filter-bar">
      <label className="filter-bar__field">
        Provider
        <select
          className="filter-bar__select"
          aria-label="Provider"
          value={filters.provider ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onChange({ ...filters, provider: value === '' ? null : value })
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
      <label className="filter-bar__field" title={hiddenTitle}>
        <input
          className="filter-bar__check"
          type="checkbox"
          aria-label="Show hidden models"
          checked={filters.includeHidden}
          onChange={(event) => onChange({ ...filters, includeHidden: event.target.checked })}
        />
        Show hidden models
        {hiddenCount > 0 ? <span className="filter-bar__hint">({hiddenCount})</span> : null}
      </label>
      <label
        className="filter-bar__field"
        title="Show only models on the Pareto frontier for the selected metric — best score for each price tier, and no model beats them on both price and score."
      >
        <input
          className="filter-bar__check"
          type="checkbox"
          aria-label="Pareto only"
          checked={filters.paretoOnly}
          onChange={(event) => onChange({ ...filters, paretoOnly: event.target.checked })}
        />
        Pareto only
      </label>
    </div>
  )
}
