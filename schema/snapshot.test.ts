import { describe, expect, test } from 'vitest'
import { modelRowSchema, SNAPSHOT_DEV_URL, snapshotSchema, unmatchedEntrySchema } from './snapshot'

function validSnapshot() {
  return {
    schemaVersion: 1 as const,
    generatedAt: '2026-08-21T12:00:00.000Z',
    source: {
      aaIndexVersion: 1,
      attribution: 'Artificial Analysis (artificialanalysis.ai)' as const,
    },
    coverage: {
      totalRows: 47,
      resolved: 43,
      intelligence: 43,
      coding: 31,
      agentic: 31,
      aaCostPerTask: 29,
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

describe('snapshotSchema', () => {
  test('1 — fully-populated valid snapshot', () => {
    expect(snapshotSchema.safeParse(validSnapshot()).success).toBe(true)
  })

  test('2 — intelligence: null', () => {
    const base = validSnapshot()
    const input = {
      ...base,
      models: [{ ...base.models[0]!, intelligence: null }],
    }
    expect(snapshotSchema.safeParse(input).success).toBe(true)
  })

  test('3 — schemaVersion: 2', () => {
    const input = { ...validSnapshot(), schemaVersion: 2 }
    expect(snapshotSchema.safeParse(input).success).toBe(false)
  })

  test('4 — models: []', () => {
    const input = { ...validSnapshot(), models: [] }
    expect(snapshotSchema.safeParse(input).success).toBe(true)
  })

  test('5 — intelligence: "63.1" (string)', () => {
    const input = validSnapshot()
    input.models[0]!.intelligence = '63.1' as unknown as number
    expect(snapshotSchema.safeParse(input).success).toBe(false)
  })

  test('6 — generatedAt: "2026-08-21" (not ISO datetime)', () => {
    const input = { ...validSnapshot(), generatedAt: '2026-08-21' }
    expect(snapshotSchema.safeParse(input).success).toBe(false)
  })

  test('7 — attribution is a different string', () => {
    const input = validSnapshot()
    input.source = {
      ...input.source,
      attribution: 'Other Attribution' as 'Artificial Analysis (artificialanalysis.ai)',
    }
    expect(snapshotSchema.safeParse(input).success).toBe(false)
  })

  test('8 — cursorSlug: ""', () => {
    const input = validSnapshot()
    input.models[0]!.cursorSlug = ''
    expect(snapshotSchema.safeParse(input).success).toBe(false)
  })
})

describe('modelRowSchema', () => {
  test('9 — every nullable field null', () => {
    const row = {
      cursorName: 'Fixture Model',
      cursorSlug: 'fixture-model',
      provider: 'Fixture Provider',
      hidden: false,
      aaSlug: null,
      aaName: null,
      aaVariantNote: null,
      intelligence: null,
      coding: null,
      agentic: null,
      aaCostPerTask: null,
      priceInput: null,
      priceOutput: null,
      priceCacheRead: null,
      priceCacheWrite: null,
    }
    expect(modelRowSchema.safeParse(row).success).toBe(true)
  })
})

test('10 — SNAPSHOT_DEV_URL', () => {
  expect(SNAPSHOT_DEV_URL).toBe('/__snapshot')
})

test('11 — unmatchedEntrySchema', () => {
  expect(unmatchedEntrySchema.safeParse({ cursorName: 'x', reason: 'y' }).success).toBe(true)
})
