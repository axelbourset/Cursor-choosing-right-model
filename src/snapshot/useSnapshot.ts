import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Snapshot } from '@schema/snapshot'
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
  readonly clear: () => Promise<void>
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
  const response = await fetch('/__snapshot')
  if (!response.ok) {
    return null
  }
  return response.text()
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'))
    }
    reader.readAsText(file)
  })
}

export function useSnapshot(): UseSnapshot {
  const storage = useMemo(() => createLocalStoragePort(), [])
  const [result, setResult] = useState<LoadResult>({ kind: 'empty' })
  const [lastGood, setLastGood] = useState<Snapshot | null>(null)

  const resolveSnapshot = useCallback(async () => {
    const loaded = await loadSnapshot(storage, fetchLocalSnapshot)
    setResult(loaded)
    if (loaded.kind === 'ok') {
      setLastGood(loaded.snapshot)
    }
    return loaded
  }, [storage])

  useEffect(() => {
    let cancelled = false
    void loadSnapshot(storage, fetchLocalSnapshot).then((loaded) => {
      if (cancelled) {
        return
      }
      setResult(loaded)
      if (loaded.kind === 'ok') {
        setLastGood(loaded.snapshot)
      }
    })
    return () => {
      cancelled = true
    }
  }, [storage])

  const acceptFile = useCallback(
    async (file: File) => {
      const raw = await readFileAsText(file)
      const stored = storeDroppedSnapshot(raw, storage)
      setResult(stored)
      if (stored.kind === 'ok') {
        setLastGood(stored.snapshot)
      }
    },
    [storage],
  )

  const useLocalFile = useCallback(async () => {
    clearStoredSnapshot(storage)
    await resolveSnapshot()
  }, [resolveSnapshot, storage])

  const clear = useCallback(async () => {
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
