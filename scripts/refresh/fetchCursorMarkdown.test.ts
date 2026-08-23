import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  CURSOR_MARKDOWN_URL,
  CursorMarkdownFetchError,
  fetchCursorMarkdown,
} from './fetchCursorMarkdown'
import type { Transport } from './transport'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')

type ResponseSpec = {
  readonly body: string
  readonly status?: number
}

function createTransport(specs: readonly ResponseSpec[]): {
  transport: Transport
  calls: Array<{ url: string; headers: Readonly<Record<string, string>> }>
  jsonCalled: boolean
} {
  const calls: Array<{ url: string; headers: Readonly<Record<string, string>> }> = []
  let jsonCalled = false
  let index = 0

  const transport: Transport = async (url, headers) => {
    calls.push({ url, headers })
    const spec = specs[index]
    index += 1
    if (!spec) {
      throw new Error('unexpected transport call')
    }

    const body = spec.body
    return {
      status: spec.status ?? 200,
      headers: {},
      json: async () => {
        jsonCalled = true
        return JSON.parse(body)
      },
      text: async () => body,
    }
  }

  return {
    transport,
    calls,
    get jsonCalled() {
      return jsonCalled
    },
  }
}

async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(fixturesDir, name), 'utf-8')
}

async function expectCursorMarkdownFetchError(promise: Promise<unknown>, pattern: RegExp) {
  let error: unknown
  try {
    await promise
    expect.fail('expected CursorMarkdownFetchError')
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(CursorMarkdownFetchError)
  expect((error as Error).message).toMatch(pattern)
}

describe('fetchCursorMarkdown', () => {
  test('1 — 200 with the fixture markdown returns the exact string', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')
    const { transport } = createTransport([{ body: markdown }])

    const result = await fetchCursorMarkdown(transport)

    expect(result).toBe(markdown)
  })

  test('2 — the URL requested equals CURSOR_MARKDOWN_URL', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')
    const { transport, calls } = createTransport([{ body: markdown }])

    await fetchCursorMarkdown(transport)

    expect(calls[0]?.url).toBe(CURSOR_MARKDOWN_URL)
  })

  test('3 — 404 throws matching /404/', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')
    const { transport } = createTransport([{ body: markdown, status: 404 }])

    await expectCursorMarkdownFetchError(fetchCursorMarkdown(transport), /404/)
  })

  test("4 — 200 with 'tiny' throws matching /below floor/", async () => {
    const { transport } = createTransport([{ body: 'tiny' }])

    await expectCursorMarkdownFetchError(fetchCursorMarkdown(transport), /below floor/)
  })

  test('5 — the call passes no x-api-key header', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')
    const { transport, calls } = createTransport([{ body: markdown }])

    await fetchCursorMarkdown(transport)

    expect(calls[0]?.headers['x-api-key']).toBeUndefined()
  })

  test('6 — text() is used, not json()', async () => {
    const markdown = await loadFixture('cursor-models.fixture.md')
    const { transport, jsonCalled } = createTransport([{ body: markdown }])

    await fetchCursorMarkdown(transport)

    expect(jsonCalled).toBe(false)
  })
})
