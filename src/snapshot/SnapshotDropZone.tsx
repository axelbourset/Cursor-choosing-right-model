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
    <label>
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
    <div>
      <ol>
        <li>Get a free API key at artificialanalysis.ai</li>
        <li>git clone … && npm install</li>
        <li>Paste the key into .env, then run npm run refresh</li>
        <li>Drop the resulting data/models.json above</li>
      </ol>
      <p>Your file stays in this browser. It is never uploaded.</p>
      <p>Data: Artificial Analysis (artificialanalysis.ai)</p>
    </div>
  )
}

function InvalidContent({ errors }: { readonly errors: readonly string[] }) {
  return (
    <div>
      <p>Not a valid snapshot:</p>
      <ul>
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
    <div>
      <p>source: {source === 'dropped' ? 'dropped file' : 'local file'}</p>
      {source === 'dropped' ? (
        <button type="button" onClick={onUseLocal}>
          use local file
        </button>
      ) : null}
      <button type="button" onClick={onClear}>
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
