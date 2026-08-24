import type { Filters } from '@domain/selection'

export type FilterBarProps = {
  readonly filters: Filters
  readonly providers: readonly string[]
  readonly onChange: (f: Filters) => void
}

export function FilterBar({ filters, providers, onChange }: FilterBarProps) {
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
      <label className="filter-bar__field">
        <input
          className="filter-bar__check"
          type="checkbox"
          aria-label="include hidden"
          checked={filters.includeHidden}
          onChange={(event) => onChange({ ...filters, includeHidden: event.target.checked })}
        />
        include hidden
      </label>
      <label className="filter-bar__field">
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
