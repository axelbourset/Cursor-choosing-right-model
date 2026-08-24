import type { ReactNode } from 'react'
import type { Snapshot } from '@schema/snapshot'
import type { LoadResult } from './loadSnapshot'

export type SnapshotDropZoneProps = {
  readonly result: LoadResult
  readonly lastGood: Snapshot | null
  readonly onFile: (file: File) => void
  readonly onUseLocal: () => void
  readonly onClear: () => void
  readonly children?: ReactNode
}

function FileInput({ onFile }: { readonly onFile: (file: File) => void }) {
  return (
    <label className="dropzone__target">
      Snapshot file
      <input
        type="file"
        accept="application/json"
        aria-label="Snapshot file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) {
            onFile(file)
          }
          event.target.value = ''
        }}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (file !== undefined) {
            onFile(file)
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
      />
    </label>
  )
}

function EmptyContent() {
  return (
    <div className="dropzone__guide">
      <ol className="dropzone__steps">
        <li>Get a free API key at artificialanalysis.ai</li>
        <li>git clone … && npm install</li>
        <li>Paste the key into .env, then run npm run refresh</li>
        <li>Drop the resulting data/models.json above</li>
      </ol>
      <p className="dropzone__assure">Your file stays in this browser. It is never uploaded.</p>
      <p className="dropzone__attribution">Data: Artificial Analysis (artificialanalysis.ai)</p>
    </div>
  )
}

function InvalidContent({ errors }: { readonly errors: readonly string[] }) {
  return (
    <div className="notice notice--error">
      <p>Not a valid snapshot:</p>
      <ul className="notice__list">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  )
}

function StaleContent({ found, expected }: { readonly found: number; readonly expected: number }) {
  return (
    <p>
      Snapshot version {found}, this build expects {expected} — re-run npm run refresh
    </p>
  )
}

function OkBanner({
  source,
  onUseLocal,
  onClear,
}: {
  readonly source: 'dropped' | 'local'
  readonly onUseLocal: () => void
  readonly onClear: () => void
}) {
  return (
    <div className="source-banner">
      <p className="source-banner__label">
        source: {source === 'dropped' ? 'dropped file' : 'local file'}
      </p>
      {source === 'dropped' ? (
        <button className="btn btn--ghost" type="button" onClick={onUseLocal}>
          use local file
        </button>
      ) : null}
      <button className="btn btn--ghost" type="button" onClick={onClear}>
        clear data
      </button>
    </div>
  )
}

export function SnapshotDropZone({
  result,
  lastGood,
  onFile,
  onUseLocal,
  onClear,
  children,
}: SnapshotDropZoneProps) {
  const showChildren = result.kind === 'ok' || (result.kind === 'invalid' && lastGood !== null)

  return (
    <div>
      <FileInput onFile={onFile} />
      {result.kind === 'empty' ? <EmptyContent /> : null}
      {result.kind === 'invalid' ? <InvalidContent errors={result.errors} /> : null}
      {result.kind === 'stale' ? (
        <StaleContent found={result.found} expected={result.expected} />
      ) : null}
      {result.kind === 'ok' ? (
        <OkBanner source={result.source} onUseLocal={onUseLocal} onClear={onClear} />
      ) : null}
      {showChildren ? children : null}
    </div>
  )
}
