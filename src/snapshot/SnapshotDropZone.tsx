import type { ReactNode } from 'react'
import { displayedSnapshot, type LoadedSnapshot, type LoadResult } from './loadSnapshot'

export type SnapshotDropZoneProps = {
  readonly result: LoadResult
  readonly lastGood: LoadedSnapshot | null
  readonly onFile: (file: File) => void
  readonly children?: ReactNode
}

function FileInput({ onFile }: { readonly onFile: (file: File) => void }) {
  return (
    <label
      className="dropzone__target"
      // On the LABEL, not the input: styles.css clips the input to 1x1, so a drop on the
      // visible panel never reached it and the browser navigated away instead.
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
    >
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
      />
    </label>
  )
}

/** The snapshot is loaded and usable; only persistence failed. Says so without implying the
 *  file was bad. */
function UnsavedNotice({ reason }: { readonly reason: string }) {
  return (
    <p className="dropzone__unsaved" role="status">
      Loaded, but not saved for next time ({reason}). Drop the file again after reloading.
    </p>
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
  const loaded = result.kind === 'ok' || result.kind === 'unsaved'
  const shown = displayedSnapshot(result, lastGood)

  // `loading` renders nothing at all: it is the state on mount, and showing the onboarding
  // guide there flashes "get an API key, git clone…" at users who already have a snapshot.
  if (result.kind === 'loading') {
    return (
      <div className="dropzone dropzone--loading" role="status" aria-busy="true">
        <span className="dropzone__loading-label">Loading your snapshot…</span>
      </div>
    )
  }

  // The children sit outside `.dropzone`: it is a 32rem onboarding column, and after a failed
  // load the last good snapshot renders below it at full width.
  return (
    <div>
      {loaded ? null : (
        <div className="dropzone">
          <FileInput onFile={onFile} />
          {result.kind === 'empty' ? <EmptyContent /> : null}
          {result.kind === 'invalid' ? <InvalidContent errors={result.errors} /> : null}
          {result.kind === 'stale' ? (
            <StaleContent found={result.found} expected={result.expected} />
          ) : null}
        </div>
      )}
      {shown?.unsavedReason === undefined ? null : <UnsavedNotice reason={shown.unsavedReason} />}
      {shown === null ? null : children}
    </div>
  )
}
