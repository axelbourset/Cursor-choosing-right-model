import { describe, expect, test, vi } from 'vitest'
import type { Snapshot } from '@schema/snapshot'
import {
  clearStoredSnapshot,
  loadSnapshot,
  parseSnapshot,
  STORAGE_KEY,
  storeDroppedSnapshot,
  type StoragePort,
} from './loadSnapshot'

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
    unmatched: [{ cursorName: 'Fixture Unmatched', reason: 'no AA record' }],
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

function createStorage(initial: string | null = null): StoragePort & {
  readonly values: Map<string, string>
} {
  const values = new Map<string, string>()
  if (initial !== null) {
    values.set(STORAGE_KEY, initial)
  }
  return {
    values,
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      values.set(key, value)
    },
    remove: (key) => {
      values.delete(key)
    },
  }
}

describe('parseSnapshot', () => {
  test('1 — valid snapshot JSON, source dropped', () => {
    const raw = JSON.stringify(validSnapshot())
    const result = parseSnapshot(raw, 'dropped')
    expect(result).toEqual({
      kind: 'ok',
      snapshot: validSnapshot(),
      source: 'dropped',
    })
  })

  test('2 — not json', () => {
    const result = parseSnapshot('not json', 'dropped')
    expect(result.kind).toBe('invalid')
    if (result.kind === 'invalid') {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  test('3 — valid JSON, wrong shape', () => {
    const result = parseSnapshot(JSON.stringify({ models: 'nope' }), 'dropped')
    expect(result.kind).toBe('invalid')
  })

  test('4 — valid shape with schemaVersion 99', () => {
    const snapshot = { ...validSnapshot(), schemaVersion: 99 }
    const result = parseSnapshot(JSON.stringify(snapshot), 'dropped')
    expect(result).toEqual({ kind: 'stale', found: 99, expected: 1 })
  })

  test('12 — never throws', () => {
    const inputs = ['', 'not json', '{', '{"schemaVersion":99}', '\u0000', '[]']
    for (const input of inputs) {
      expect(() => parseSnapshot(input, 'dropped')).not.toThrow()
    }
  })
})

describe('loadSnapshot', () => {
  test('5 — storage empty, fetchLocal returns valid JSON', async () => {
    const storage = createStorage()
    const raw = JSON.stringify(validSnapshot())
    const result = await loadSnapshot(storage, async () => raw)
    expect(result).toEqual({
      kind: 'ok',
      snapshot: validSnapshot(),
      source: 'local',
    })
  })

  test('6 — storage has valid JSON, fetchLocal also valid', async () => {
    const storage = createStorage(JSON.stringify(validSnapshot()))
    const result = await loadSnapshot(storage, async () => JSON.stringify(validSnapshot()))
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.source).toBe('dropped')
    }
  })

  test('7 — storage empty, fetchLocal returns null', async () => {
    const storage = createStorage()
    const result = await loadSnapshot(storage, async () => null)
    expect(result).toEqual({ kind: 'empty' })
  })

  test('8 — storage has garbage, fetchLocal valid', async () => {
    const storage = createStorage('not json')
    const raw = JSON.stringify(validSnapshot())
    const result = await loadSnapshot(storage, async () => raw)
    expect(result).toEqual({
      kind: 'ok',
      snapshot: validSnapshot(),
      source: 'local',
    })
  })

  test('8b — storage has garbage, fetchLocal returns null', async () => {
    const storage = createStorage('not json')
    const result = await loadSnapshot(storage, async () => null)
    expect(result.kind).toBe('invalid')
  })

  test('8c — storage is stale, fetchLocal returns null', async () => {
    const storage = createStorage(JSON.stringify({ ...validSnapshot(), schemaVersion: 99 }))
    const result = await loadSnapshot(storage, async () => null)
    expect(result).toEqual({ kind: 'stale', found: 99, expected: 1 })
  })
})

describe('storeDroppedSnapshot', () => {
  test('9 — valid JSON', () => {
    const storage = createStorage()
    const raw = JSON.stringify(validSnapshot())
    const setSpy = vi.spyOn(storage, 'set')
    const result = storeDroppedSnapshot(raw, storage)
    expect(result.kind).toBe('ok')
    expect(setSpy).toHaveBeenCalledOnce()
    expect(setSpy).toHaveBeenCalledWith(STORAGE_KEY, raw)
  })

  test('10 — garbage', () => {
    const storage = createStorage()
    const setSpy = vi.spyOn(storage, 'set')
    const result = storeDroppedSnapshot('not json', storage)
    expect(result.kind).toBe('invalid')
    expect(setSpy).not.toHaveBeenCalled()
  })
})

describe('clearStoredSnapshot', () => {
  test('11 — remove called with STORAGE_KEY', () => {
    const storage = createStorage(JSON.stringify(validSnapshot()))
    const removeSpy = vi.spyOn(storage, 'remove')
    clearStoredSnapshot(storage)
    expect(removeSpy).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledWith(STORAGE_KEY)
  })
})
