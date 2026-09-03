import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  CursorPricingError,
  fetchCursorPricingJson,
  type CursorPrice,
} from './fetchCursorPricingJson'
import type { Transport } from './transport'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')

type ResponseSpec = {
  readonly body: unknown
  readonly status?: number
}

function createTransport(specs: readonly ResponseSpec[]): Transport {
  let index = 0
  return async (url, headers) => {
    void url
    void headers
    const spec = specs[index]
    index += 1
    if (!spec) {
      throw new Error('unexpected transport call')
    }

    const body = spec.body
    return {
      status: spec.status ?? 200,
      headers: {},
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }
}

async function loadFixture(name: string) {
  const text = await readFile(path.join(fixturesDir, name), 'utf-8')
  return JSON.parse(text) as unknown
}

function findRow(rows: readonly CursorPrice[], slug: string) {
  const row = rows.find((r) => r.slug === slug)
  if (!row) {
    throw new Error(`row not found: ${slug}`)
  }
  return row
}

async function expectCursorPricingError(promise: Promise<unknown>, pattern: RegExp) {
  let error: unknown
  try {
    await promise
    expect.fail('expected CursorPricingError')
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(CursorPricingError)
  expect((error as Error).message).toMatch(pattern)
}

describe('fetchCursorPricingJson', () => {
  test('1 — the fixture yields 11 rows', async () => {
    const fixture = await loadFixture('cursor-pricing.json')
    const transport = createTransport([{ body: fixture }])

    const rows = await fetchCursorPricingJson(transport)

    expect(rows.length).toBe(11)
  })

  test('2 — claude-opus-5 row has input 5, output 25, cacheRead 0.5', async () => {
    const fixture = await loadFixture('cursor-pricing.json')
    const transport = createTransport([{ body: fixture }])

    const rows = await fetchCursorPricingJson(transport)
    const row = findRow(rows, 'claude-opus-5')

    expect(row.input).toBe(5)
    expect(row.output).toBe(25)
    expect(row.cacheRead).toBe(0.5)
  })

  test('3 — schemaVersion 2 throws matching /schemaVersion/ and /2/', async () => {
    const fixture = await loadFixture('cursor-pricing.json')
    const body = { ...(fixture as Record<string, unknown>), schemaVersion: 2 }
    const transport = createTransport([{ body }])

    await expectCursorPricingError(fetchCursorPricingJson(transport), /schemaVersion/)
    await expectCursorPricingError(fetchCursorPricingJson(createTransport([{ body }])), /2/)
  })

  test('4 — status 404 throws matching /404/', async () => {
    const fixture = await loadFixture('cursor-pricing.json')
    const transport = createTransport([{ body: fixture, status: 404 }])

    await expectCursorPricingError(fetchCursorPricingJson(transport), /404/)
  })

  test('5 — models: [] throws matching /below floor/', async () => {
    const transport = createTransport([
      {
        body: {
          schemaVersion: 1,
          currency: 'USD',
          unit: 'per_1m_tokens',
          models: [],
        },
      },
    ])

    await expectCursorPricingError(fetchCursorPricingJson(transport), /below floor/)
  })

  test('6 — a row with no cacheWrite key has cacheWrite === null', async () => {
    const fixture = (await loadFixture('cursor-pricing.json')) as {
      schemaVersion: number
      currency: string
      unit: string
      models: Record<string, unknown>[]
    }
    const models = fixture.models.map((model, index) => {
      if (index !== 0) {
        return model
      }
      const { pricing, ...rest } = model
      const pricingRecord = { ...(pricing as Record<string, unknown>) }
      delete pricingRecord.cacheWrite
      return { ...rest, pricing: pricingRecord }
    })
    const transport = createTransport([{ body: { ...fixture, models } }])

    const rows = await fetchCursorPricingJson(transport)

    expect(rows[0]?.cacheWrite).toBeNull()
  })

  test('7 — every returned row has a non-empty slug', async () => {
    const fixture = await loadFixture('cursor-pricing.json')
    const transport = createTransport([{ body: fixture }])

    const rows = await fetchCursorPricingJson(transport)

    expect(rows.every((row) => row.slug.length > 0)).toBe(true)
  })
})
