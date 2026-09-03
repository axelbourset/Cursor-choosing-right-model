import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { AaFetchError, fetchArtificialAnalysis, type AaModel } from './fetchArtificialAnalysis'
import type { Transport } from './transport'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')

type PageSpec = {
  readonly body: unknown
  readonly status?: number
  readonly headers?: Readonly<Record<string, string>>
}

function makeEnvelope(
  data: unknown[],
  pagination: {
    page: number
    page_size: number
    total_pages: number
    has_more: boolean
  },
) {
  return {
    tier: 'free',
    intelligence_index_version: 4.1,
    pagination,
    data,
  }
}

function makeAaRecord(
  overrides: {
    slug?: string
    name?: string
    evaluations?: Record<string, number | null>
    costPerTask?: number | null
    omitAgenticKey?: boolean
    omitEvaluations?: boolean
  } = {},
) {
  const evaluations: Record<string, number | null> = overrides.omitAgenticKey
    ? {
        artificial_analysis_intelligence_index: 50,
        artificial_analysis_coding_index: 60,
      }
    : {
        artificial_analysis_intelligence_index: 50,
        artificial_analysis_coding_index: 60,
        artificial_analysis_agentic_index: 40,
        ...overrides.evaluations,
      }

  const record: Record<string, unknown> = {
    slug: overrides.slug ?? 'fixture-slug',
    name: overrides.name ?? 'Fixture Model',
  }

  if (!overrides.omitEvaluations) {
    record.evaluations = evaluations
  }

  if (overrides.costPerTask !== undefined) {
    record.artificial_analysis_intelligence_index_cost =
      overrides.costPerTask === null
        ? null
        : {
            cost_per_task: { total_cost: overrides.costPerTask },
          }
  } else {
    record.artificial_analysis_intelligence_index_cost = {
      cost_per_task: { total_cost: 1 },
    }
  }

  return record
}

function createTransport(pages: readonly PageSpec[]): {
  transport: Transport
  calls: { url: string; headers: Readonly<Record<string, string>> }[]
} {
  const calls: { url: string; headers: Readonly<Record<string, string>> }[] = []
  let index = 0

  const transport: Transport = async (url, headers) => {
    calls.push({ url, headers })
    const page = pages[index]
    index += 1
    if (!page) {
      throw new Error('unexpected transport call')
    }

    const body = page.body
    return {
      status: page.status ?? 200,
      headers: page.headers ?? {},
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }

  return { transport, calls }
}

async function loadFixture(name: string) {
  const text = await readFile(path.join(fixturesDir, name), 'utf-8')
  return JSON.parse(text) as {
    data: unknown[]
    pagination: {
      page: number
      page_size: number
      total_pages: number
      has_more: boolean
    }
    intelligence_index_version: number
    tier: string
  }
}

function trimFixture(fixture: Awaited<ReturnType<typeof loadFixture>>, count: number) {
  return {
    ...fixture,
    data: fixture.data.slice(0, count),
  }
}

function findModel(models: readonly AaModel[], slug: string) {
  const model = models.find((m) => m.slug === slug)
  if (!model) {
    throw new Error(`model not found: ${slug}`)
  }
  return model
}

async function expectAaFetchError(promise: Promise<unknown>, pattern: RegExp) {
  let error: unknown
  try {
    await promise
    expect.fail('expected AaFetchError')
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(AaFetchError)
  expect((error as Error).message).toMatch(pattern)
}

describe('fetchArtificialAnalysis', () => {
  test('1 — page1 has_more true, page2 has_more false yields 4 models, no third request', async () => {
    const page1Fixture = trimFixture(await loadFixture('aa-free-page-1.synthetic.json'), 2)
    const page2Fixture = trimFixture(await loadFixture('aa-free-page-2.synthetic.json'), 2)
    const { transport, calls } = createTransport([{ body: page1Fixture }, { body: page2Fixture }])

    const result = await fetchArtificialAnalysis('test-key', transport, 4)

    expect(result.models.length).toBe(4)
    expect(calls.length).toBe(2)
  })

  test('2 — pagination success makes exactly 2 transport calls', async () => {
    const page1Fixture = trimFixture(await loadFixture('aa-free-page-1.synthetic.json'), 2)
    const page2Fixture = trimFixture(await loadFixture('aa-free-page-2.synthetic.json'), 2)
    const { transport, calls } = createTransport([{ body: page1Fixture }, { body: page2Fixture }])

    await fetchArtificialAnalysis('test-key', transport, 4)

    expect(calls.length).toBe(2)
  })

  test('3 — has_more true past total_pages throws', async () => {
    const stuckPage = makeEnvelope([makeAaRecord()], {
      page: 1,
      page_size: 1,
      total_pages: 2,
      has_more: true,
    })
    const { transport } = createTransport([{ body: stuckPage }, { body: stuckPage }])

    await expectAaFetchError(
      fetchArtificialAnalysis('test-key', transport, 1),
      /has_more true past total_pages/,
    )
  })

  test('4 — status 429 throws rate limit', async () => {
    const page = makeEnvelope([makeAaRecord()], {
      page: 1,
      page_size: 1,
      total_pages: 1,
      has_more: false,
    })
    const { transport } = createTransport([{ body: page, status: 429 }])

    await expectAaFetchError(fetchArtificialAnalysis('test-key', transport, 1), /rate limit/i)
  })

  test('5 — status 500 throws including status', async () => {
    const page = makeEnvelope([makeAaRecord()], {
      page: 1,
      page_size: 1,
      total_pages: 1,
      has_more: false,
    })
    const { transport } = createTransport([{ body: page, status: 500 }])

    await expectAaFetchError(fetchArtificialAnalysis('test-key', transport, 1), /500/)
  })

  test('6 — below minExpectedModels throws below floor', async () => {
    const page = makeEnvelope([makeAaRecord()], {
      page: 1,
      page_size: 1,
      total_pages: 1,
      has_more: false,
    })
    const { transport } = createTransport([{ body: page }])

    await expectAaFetchError(fetchArtificialAnalysis('test-key', transport, 100), /below floor/)
  })

  test('7 — missing artificial_analysis_agentic_index key throws naming key', async () => {
    const page = makeEnvelope([makeAaRecord({ omitAgenticKey: true })], {
      page: 1,
      page_size: 1,
      total_pages: 1,
      has_more: false,
    })
    const { transport } = createTransport([{ body: page }])

    await expectAaFetchError(
      fetchArtificialAnalysis('test-key', transport, 1),
      /artificial_analysis_agentic_index/,
    )
  })

  test('8 — testomatic-9 maps intelligence 50, coding 60, agentic 40, costPerTask 1', async () => {
    const page = makeEnvelope(
      [
        makeAaRecord({
          slug: 'testomatic-9',
          name: 'Testomatic 9',
          evaluations: {
            artificial_analysis_intelligence_index: 50,
            artificial_analysis_coding_index: 60,
            artificial_analysis_agentic_index: 40,
          },
          costPerTask: 1,
        }),
      ],
      {
        page: 1,
        page_size: 1,
        total_pages: 1,
        has_more: false,
      },
    )
    const { transport } = createTransport([{ body: page }])

    const result = await fetchArtificialAnalysis('test-key', transport, 1)
    const model = findModel(result.models, 'testomatic-9')

    expect(model.intelligence).toBe(50)
    expect(model.coding).toBe(60)
    expect(model.agentic).toBe(40)
    expect(model.costPerTask).toBe(1)
  })

  test('9 — sparsely-measured-1 has null coding, agentic, costPerTask — not 0', async () => {
    const page = makeEnvelope(
      [
        makeAaRecord({
          slug: 'sparsely-measured-1',
          name: 'Sparsely Measured 1',
          evaluations: {
            artificial_analysis_intelligence_index: 30,
            artificial_analysis_coding_index: null,
            artificial_analysis_agentic_index: null,
          },
          costPerTask: null,
        }),
      ],
      {
        page: 1,
        page_size: 1,
        total_pages: 1,
        has_more: false,
      },
    )
    const { transport } = createTransport([{ body: page }])

    const result = await fetchArtificialAnalysis('test-key', transport, 1)
    const model = findModel(result.models, 'sparsely-measured-1')

    expect(model.coding).toBeNull()
    expect(model.agentic).toBeNull()
    expect(model.costPerTask).toBeNull()
    expect(model.coding).not.toBe(0)
    expect(model.agentic).not.toBe(0)
    expect(model.costPerTask).not.toBe(0)
  })

  test('10 — x-ratelimit-remaining on last page is returned', async () => {
    const page1Fixture = trimFixture(await loadFixture('aa-free-page-1.synthetic.json'), 2)
    const page2Fixture = trimFixture(await loadFixture('aa-free-page-2.synthetic.json'), 2)
    const { transport } = createTransport([
      { body: page1Fixture, headers: { 'x-ratelimit-remaining': '99' } },
      {
        body: page2Fixture,
        headers: { 'x-ratelimit-remaining': '94' },
      },
    ])

    const result = await fetchArtificialAnalysis('test-key', transport, 4)

    expect(result.rateLimitRemaining).toBe('94')
  })

  test('11 — x-api-key header equals apiKey argument', async () => {
    const page = makeEnvelope([makeAaRecord()], {
      page: 1,
      page_size: 1,
      total_pages: 1,
      has_more: false,
    })
    const { transport, calls } = createTransport([{ body: page }])

    await fetchArtificialAnalysis('my-secret-key', transport, 1)

    expect(calls[0]?.headers['x-api-key']).toBe('my-secret-key')
  })

  test('12 — first request URL ends with /language/models/free?page=1', async () => {
    const page = makeEnvelope([makeAaRecord()], {
      page: 1,
      page_size: 1,
      total_pages: 1,
      has_more: false,
    })
    const { transport, calls } = createTransport([{ body: page }])

    await fetchArtificialAnalysis('test-key', transport, 1)

    expect(calls[0]?.url.endsWith('/language/models/free?page=1')).toBe(true)
  })
})
