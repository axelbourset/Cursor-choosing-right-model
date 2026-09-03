import { useCallback, useEffect, useMemo, useState } from 'react'
import { SNAPSHOT_DEV_URL, type Snapshot } from '@schema/snapshot'
import {
  clearStoredSnapshot,
  loadSnapshot,
  storeDroppedSnapshot,
  type LoadResult,
  type StoragePort,
} from './loadSnapshot'

export type UseSnapshot = {
  readonly result: LoadResult
  /** The last successfully-loaded snapshot, retained so an invalid drop does not blank the view. */
  readonly lastGood: Snapshot | null
  readonly acceptFile: (file: File) => Promise<void>
  readonly useLocalFile: () => Promise<void>
  readonly clear: () => void
}

function createLocalStoragePort(): StoragePort {
  return {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => {
      localStorage.setItem(key, value)
    },
    remove: (key) => {
      localStorage.removeItem(key)
    },
  }
}

async function fetchLocalSnapshot(): Promise<string | null> {
  // Dev-server middleware only (vite.plugins.ts is `apply: 'serve'`). On a host with an SPA
  // catch-all this path returns index.html with status 200, and JSON.parse would report
  // "Unexpected token '<'" to a first-time visitor instead of the onboarding guide.
  if (import.meta.env.PROD) {
    return null
  }

  const response = await fetch(SNAPSHOT_DEV_URL)
  if (!response.ok) {
    return null
  }

  // A host with an SPA catch-all answers this route with index.html and status 200; treat
  // that as "no local snapshot" rather than letting JSON.parse report a syntax error.
  if (response.headers.get('content-type')?.includes('text/html') === true) {
    return null
  }

  return response.text()
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // `result` is string | ArrayBuffer | null; coercing the other two yields "null" and
      // "[object ArrayBuffer]", which reach the user as a confusing JSON syntax error.
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Expected text from FileReader'))
      }
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'))
    }
    reader.onabort = () => {
      reject(new Error('File read was aborted'))
    }
    reader.readAsText(file)
  })
}

export function useSnapshot(): UseSnapshot {
  const storage = useMemo(() => createLocalStoragePort(), [])
  const [result, setResult] = useState<LoadResult>({ kind: 'loading' })
  const [lastGood, setLastGood] = useState<Snapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      // `fetch` rejects on a network error, so this needs a catch: without one the mount
      // effect leaves the UI stuck on `loading` with only a console rejection.
      const loaded = await loadSnapshot(storage, fetchLocalSnapshot).catch((): LoadResult => ({
        kind: 'empty',
      }))
      if (cancelled) {
        return
      }
      setResult(loaded)
      if (loaded.kind === 'ok') {
        setLastGood(loaded.snapshot)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [storage])

  const acceptFile = useCallback(
    async (file: File) => {
      // The try covers the READ only. A storage failure is handled inside
      // storeDroppedSnapshot, which downgrades to `unsaved` — wrapping it here meant a
      // valid snapshot was thrown away and reported as an invalid file.
      let raw: string
      try {
        raw = await readFileAsText(file)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setResult({ kind: 'invalid', errors: [`Could not read that file: ${message}`] })
        return
      }

      const stored = storeDroppedSnapshot(raw, storage)
      setResult(stored)
      if (stored.kind === 'ok' || stored.kind === 'unsaved') {
        setLastGood(stored.snapshot)
      }
    },
    [storage],
  )

  const useLocalFile = useCallback(async () => {
    // Resolve BEFORE clearing: clearing first and then failing the fetch wiped the user's
    // snapshot and left the screen unchanged, with no way back.
    try {
      const loaded = await loadSnapshot({ ...storage, get: () => null }, fetchLocalSnapshot)
      clearStoredSnapshot(storage)
      setResult(loaded)
      if (loaded.kind === 'ok') {
        setLastGood(loaded.snapshot)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setResult({ kind: 'invalid', errors: [`Could not load the local snapshot: ${message}`] })
    }
  }, [storage])

  const clear = useCallback(() => {
    clearStoredSnapshot(storage)
    setLastGood(null)
    setResult({ kind: 'empty' })
  }, [storage])

  return {
    result,
    lastGood,
    acceptFile,
    useLocalFile,
    clear,
  }
}
