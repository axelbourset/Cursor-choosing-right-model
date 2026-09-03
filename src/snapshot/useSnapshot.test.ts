import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Snapshot } from '@schema/snapshot'
import { STORAGE_KEY } from './loadSnapshot'
import { useSnapshot } from './useSnapshot'

function validSnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-21T12:00:00.000Z',
    source: {
      aaIndexVersion: 1,
      attribution: 'Artificial Analysis (artificialanalysis.ai)',
    },
    coverage: {
      // Consistent with the single row below: snapshotSchema now rejects a coverage block
      // that contradicts models.length.
      totalRows: 1,
      resolved: 1,
      intelligence: 1,
      coding: 1,
      agentic: 1,
      aaCostPerTask: 1,
    },
    unmatched: [],
    models: [
      {
        cursorName: 'Fixture Model',
        cursorSlug: 'fixture-model',
        provider: 'Fixture Provider',
        hidden: false,
        aaSlug: 'fixture-aa-slug',
        aaName: 'Fixture AA Name',
        aaVariantNote: 'explicit variant',
        intelligence: 42.1,
        coding: 38.5,
        agentic: 35.2,
        aaCostPerTask: 1.234,
        priceInput: 0.01,
        priceOutput: 0.02,
        priceCacheRead: 0.003,
        priceCacheWrite: 0.004,
      },
    ],
  }
}

function mockFileReader(text: string) {
  class MockFileReader {
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null
    result: string | ArrayBuffer | null = null

    readAsText() {
      this.result = text
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>)
    }
  }
  vi.stubGlobal('FileReader', MockFileReader)
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSnapshot', () => {
  test('acceptFile stores a valid file', async () => {
    const raw = JSON.stringify(validSnapshot())
    mockFileReader(raw)
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))

    const { result } = renderHook(() => useSnapshot())

    await waitFor(() => {
      expect(result.current.result.kind).toBe('empty')
    })

    const file = new File([raw], 'models.json', { type: 'application/json' })
    await act(async () => {
      await result.current.acceptFile(file)
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(result.current.result.kind).toBe('ok')
    if (result.current.result.kind === 'ok') {
      expect(result.current.result.source).toBe('dropped')
    }
  })

  test('acceptFile rejects invalid file and preserves lastGood', async () => {
    const raw = JSON.stringify(validSnapshot())
    localStorage.setItem(STORAGE_KEY, raw)
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))

    const { result } = renderHook(() => useSnapshot())

    await waitFor(() => {
      expect(result.current.result.kind).toBe('ok')
    })
    const previousSnapshot = result.current.lastGood

    mockFileReader('not json')
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    await act(async () => {
      await result.current.acceptFile(file)
    })

    expect(result.current.result.kind).toBe('invalid')
    expect(result.current.lastGood).toEqual(previousSnapshot)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })

  test('clear empties storage', async () => {
    const raw = JSON.stringify(validSnapshot())
    localStorage.setItem(STORAGE_KEY, raw)
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))

    const { result } = renderHook(() => useSnapshot())

    await waitFor(() => {
      expect(result.current.result.kind).toBe('ok')
    })

    act(() => {
      result.current.clear()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(result.current.lastGood).toBeNull()
    expect(result.current.result).toEqual({ kind: 'empty' })
  })

  test('useLocalFile clears storage then re-resolves', async () => {
    const droppedRaw = JSON.stringify(validSnapshot())
    const localRaw = JSON.stringify({
      ...validSnapshot(),
      generatedAt: '2026-08-22T12:00:00.000Z',
    })
    localStorage.setItem(STORAGE_KEY, droppedRaw)
    vi.mocked(fetch).mockResolvedValue(new Response(localRaw, { status: 200 }))

    const { result } = renderHook(() => useSnapshot())

    await waitFor(() => {
      expect(result.current.result.kind).toBe('ok')
      if (result.current.result.kind === 'ok') {
        expect(result.current.result.source).toBe('dropped')
      }
    })

    await act(async () => {
      await result.current.useLocalFile()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(result.current.result.kind).toBe('ok')
    if (result.current.result.kind === 'ok') {
      expect(result.current.result.source).toBe('local')
    }
  })

  test('9 — a FileReader error surfaces as an invalid result, not an unhandled rejection', async () => {
    class FailingFileReader {
      onerror: (() => void) | null = null
      onload: (() => void) | null = null
      onabort: (() => void) | null = null
      error = new Error('read failed')
      result: string | null = null
      readAsText() {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal('FileReader', FailingFileReader)

    const { result } = renderHook(() => useSnapshot())
    await act(async () => {
      await result.current.acceptFile(new File(['{}'], 'x.json'))
    })

    expect(result.current.result.kind).toBe('invalid')
    if (result.current.result.kind === 'invalid') {
      expect(result.current.result.errors[0]).toMatch(/Could not read that file/)
    }
    vi.unstubAllGlobals()
  })

  test('10 — a full localStorage keeps the snapshot and reports it as unsaved', async () => {
    // Previously this fed '{}', which fails schema validation BEFORE storage is touched —
    // so the assertion passed without the quota path ever running.
    const valid = JSON.stringify(validSnapshot())
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
    })

    const { result } = renderHook(() => useSnapshot())
    await act(async () => {
      await result.current.acceptFile(new File([valid], 'models.json'))
    })

    expect(result.current.result.kind).toBe('unsaved')
    expect(result.current.lastGood).not.toBeNull()
    vi.unstubAllGlobals()
  })

  test('11 — a failed local re-resolve does not wipe the stored snapshot', async () => {
    const stored = JSON.stringify(validSnapshot())
    const store = new Map([[STORAGE_KEY, stored]])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )

    const { result } = renderHook(() => useSnapshot())
    await act(async () => {
      await result.current.useLocalFile()
    })

    // Storage is only cleared once the replacement has actually resolved.
    expect(store.get(STORAGE_KEY)).toBe(stored)
    vi.unstubAllGlobals()
  })
})
