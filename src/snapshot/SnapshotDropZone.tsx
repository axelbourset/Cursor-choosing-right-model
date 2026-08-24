import type { ReactNode } from 'react'
import type { Snapshot } from '@schema/snapshot'
import type { LoadResult } from './loadSnapshot'

export type SnapshotDropZoneProps = {
  readonly result: LoadResult
  readonly lastGood: Snapshot | null
  readonly onFile: (file: File) => void
  readonly children?: ReactNode
}

function FileInput({ onFile }: { readonly onFile: (file: File) => void }) {
  return (
    <label className="dropzone__target">
      <span className="dropzone__icon" aria-hidden="true">
        &#8595;
      </span>
      <span className="dropzone__headline">Drop your snapshot</span>
      <span className="dropzone__sub">
        or <span className="dropzone__browse">browse</span> for data/models.json
      </span>
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

export function SnapshotDropZone({ result, lastGood, onFile, children }: SnapshotDropZoneProps) {
  const showChildren = result.kind === 'ok' || (result.kind === 'invalid' && lastGood !== null)

  return (
    <div className={result.kind === 'ok' ? undefined : 'dropzone'}>
      {result.kind === 'ok' ? null : <FileInput onFile={onFile} />}
      {result.kind === 'empty' ? <EmptyContent /> : null}
      {result.kind === 'invalid' ? <InvalidContent errors={result.errors} /> : null}
      {result.kind === 'stale' ? (
        <StaleContent found={result.found} expected={result.expected} />
      ) : null}
      {showChildren ? children : null}
    </div>
  )
}
