type StatStripProps = {
  readonly models: number
  readonly providers: number
  readonly shown: number
  readonly total: number
  readonly frontier: number
}

type Tile = {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly modifier: string
}

/** Saturated colour blocks between the masthead and the chart — the numbers
 * that orient the page before anything else renders. Values are counts that
 * already exist in the app's selection state; nothing is computed here. */
export function StatStrip({ models, providers, shown, total, frontier }: StatStripProps) {
  if (total === 0) {
    return null
  }

  const tiles: readonly Tile[] = [
    { key: 'models', label: 'Models', value: String(models), modifier: 'stat-tile--mint' },
    {
      key: 'providers',
      label: 'Providers',
      value: String(providers),
      modifier: 'stat-tile--ultraviolet',
    },
    {
      key: 'plotted',
      label: 'Plotted',
      value: `${shown}/${total}`,
      modifier: 'stat-tile--yellow',
    },
    { key: 'frontier', label: 'Frontier', value: String(frontier), modifier: 'stat-tile--pink' },
  ]

  return (
    <section className="stat-strip" aria-label="Snapshot statistics">
      {tiles.map((tile) => (
        <div key={tile.key} className={`stat-tile ${tile.modifier}`}>
          <span className="stat-tile__label">{tile.label}</span>
          <span className="stat-tile__value">{tile.value}</span>
        </div>
      ))}
    </section>
  )
}
