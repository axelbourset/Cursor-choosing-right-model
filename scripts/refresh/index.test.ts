import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { snapshotSchema } from '@schema/snapshot'
import { fixtureTransport } from './fixtureTransport'
import { runRefresh, type RefreshDeps } from './index'
import type { SnapshotFileWriter } from './writeSnapshot'
import type { Transport } from './transport'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readFixture = (relativePath: string) => readFile(path.join(repoRoot, relativePath), 'utf-8')

type WriterCalls = {
  mkdir: string[]
  writeFile: { path: string; data: string }[]
  rename: { from: string; to: string }[]
  unlink: string[]
}

function createFakeWriter(overrides: Partial<SnapshotFileWriter> = {}): {
  writer: SnapshotFileWriter
  calls: WriterCalls
} {
  const calls: WriterCalls = { mkdir: [], writeFile: [], rename: [], unlink: [] }

  const writer: SnapshotFileWriter = {
    mkdir: async (dirPath) => {
      calls.mkdir.push(dirPath)
      if (overrides.mkdir) return overrides.mkdir(dirPath)
    },
    writeFile: async (filePath, data) => {
      calls.writeFile.push({ path: filePath, data })
      if (overrides.writeFile) return overrides.writeFile(filePath, data)
    },
    rename: async (from, to) => {
      calls.rename.push({ from, to })
      if (overrides.rename) return overrides.rename(from, to)
    },
    unlink: async (filePath) => {
      calls.unlink.push(filePath)
      if (overrides.unlink) return overrides.unlink(filePath)
    },
  }

  return { writer, calls }
}

function createFixtureDeps(overrides: Partial<RefreshDeps> = {}): {
  deps: RefreshDeps
  calls: WriterCalls
  transportCalls: string[]
} {
  const { writer, calls } = createFakeWriter(overrides.files)
  const transportCalls: string[] = []
  const baseTransport = fixtureTransport(readFixture)
  const transport: Transport = async (url, headers) => {
    transportCalls.push(url)
    return baseTransport(url, headers)
  }

  return {
    deps: {
      transport,
      files: writer,
      now: overrides.now ?? (() => '2026-08-21T12:00:00.000Z'),
      minExpectedAaModels: overrides.minExpectedAaModels ?? 40,
      overrides: overrides.overrides ?? new Map(),
      previousSnapshot: overrides.previousSnapshot ?? null,
    },
    calls,
    transportCalls,
  }
}

describe('runRefresh', () => {
  test('1 — fixtureTransport, all fixtures valid: kind ok, writeSnapshot called once', async () => {
    const { deps, calls } = createFixtureDeps()

    const result = await runRefresh(deps, 'fixture')

    expect(result.kind).toBe('ok')
    expect(calls.writeFile).toHaveLength(1)
  })

  test('2 — fetchArtificialAnalysis exercised via /language/models/free URL', async () => {
    const { deps, transportCalls } = createFixtureDeps()

    await runRefresh(deps, 'fixture')

    expect(transportCalls.some((url) => url.includes('/language/models/free'))).toBe(true)
  })

  test('3 — transport received /docs/models-and-pricing.md', async () => {
    const { deps, transportCalls } = createFixtureDeps()

    await runRefresh(deps, 'fixture')

    expect(transportCalls.some((url) => url.includes('/docs/models-and-pricing.md'))).toBe(true)
  })

  test('4 — transport returns 429: rate limit error, writeFile never called', async () => {
    const { writer, calls } = createFakeWriter()
    const base = fixtureTransport(readFixture)
    // The three fetches now run in parallel, so this transport must answer all of them and
    // fail only the AA call.
    const transport: Transport = async (url, headers) => {
      if (url.includes('/language/models/free')) {
        return {
          status: 429,
          headers: {},
          json: async () => ({}),
          text: async () => '',
        }
      }
      return base(url, headers)
    }

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 40,
        overrides: new Map(),
        previousSnapshot: null,
      },
      'fixture',
    )

    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toMatch(/rate limit/i)
    }
    expect(calls.writeFile).toHaveLength(0)
  })

  test('5 — transport returns malformed JSON: error, writeFile never called', async () => {
    const { writer, calls } = createFakeWriter()
    const transport: Transport = async (url) => {
      if (url.includes('/language/models/free')) {
        return {
          status: 200,
          headers: {},
          json: async () => {
            throw new SyntaxError('malformed JSON')
          },
          text: async () => 'not-json',
        }
      }
      throw new Error(`unexpected URL in malformed-json test: ${url}`)
    }

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 1,
        overrides: new Map(),
        previousSnapshot: null,
      },
      'fixture',
    )

    expect(result.kind).toBe('error')
    expect(calls.writeFile).toHaveLength(0)
  })

  test('6 — an override naming a dead AA slug still fails loudly, writing nothing', () => {
    // Derived mappings cannot go stale: they are read from the live payload every run. A
    // stale target can now only come from a hand-written override, which must still throw.
    return (async () => {
      const { writer, calls } = createFakeWriter()
      const { deps } = createFixtureDeps({
        files: writer,
        overrides: new Map([
          ['Claude Opus 5', { aaSlug: 'no-such-slug', reason: 'typo in the slug' }],
        ]),
      })

      const result = await runRefresh({ ...deps, files: writer }, 'fixture')

      expect(result.kind).toBe('error')
      if (result.kind === 'error') {
        expect(result.message).toMatch(/stale alias/)
      }
      expect(calls.writeFile).toHaveLength(0)
    })()
  })

  test('6b — a renamed AA slug degrades to unresolved instead of failing the run', async () => {
    const { writer, calls } = createFakeWriter()
    const base = fixtureTransport(readFixture)
    const transport: Transport = async (url, headers) => {
      if (url.includes('/language/models/free')) {
        const response = await base(url, headers)
        const envelope = (await response.json()) as { data: { slug: string }[] }
        return {
          status: 200,
          headers: response.headers,
          json: async () => ({
            ...envelope,
            data: envelope.data.map((record) =>
              record.slug === 'grok-4-6' ? { ...record, slug: 'renamed-slug' } : record,
            ),
          }),
          text: response.text,
        }
      }
      return base(url, headers)
    }

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 40,
        overrides: new Map(),
        previousSnapshot: null,
      },
      'fixture',
    )

    expect(result.kind).toBe('ok')
    const snapshot = snapshotSchema.parse(JSON.parse(calls.writeFile[0]!.data))
    expect(snapshot.models.find((m) => m.cursorName === 'Grok 4.6')?.aaSlug).toBeNull()
  })

  test('7 — writeSnapshot rejects mid-write: error propagated, not swallowed', async () => {
    const { writer, calls } = createFakeWriter({
      writeFile: async () => {
        throw new Error('disk full')
      },
    })

    const base = fixtureTransport(readFixture)
    const transport: Transport = async (url, headers) => base(url, headers)

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 40,
        overrides: new Map(),
        previousSnapshot: null,
      },
      'fixture',
    )

    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toMatch(/disk full/)
    }
    expect(calls.writeFile.length).toBeGreaterThan(0)
  })

  test('8 — injected now sets snapshot generatedAt', async () => {
    const fixedNow = '2026-01-01T00:00:00.000Z'
    const { deps, calls } = createFixtureDeps({ now: () => fixedNow })

    const result = await runRefresh(deps, 'fixture')
    expect(result.kind).toBe('ok')

    const written = calls.writeFile[0]?.data
    expect(written).toBeDefined()
    const snapshot = snapshotSchema.parse(JSON.parse(written!))
    expect(snapshot.generatedAt).toBe(fixedNow)
  })

  test('9 — success path lines include a coverage line', async () => {
    const { deps } = createFixtureDeps()

    const result = await runRefresh(deps, 'fixture')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.lines.some((line) => line.startsWith('Coverage:'))).toBe(true)
    }
  })

  test('11 — a new upstream model needs no human action: it is resolved and included', async () => {
    const { writer, calls } = createFakeWriter()
    const base = fixtureTransport(readFixture)
    const transport: Transport = async (url, headers) => {
      if (url.includes('/docs/models-and-pricing.md')) {
        const response = await base(url, headers)
        const markdown = await response.text()
        // `gpt-5` exists in the AA fixture, so the rule resolves this with no declaration.
        return {
          ...response,
          text: async () =>
            markdown.replace(
              '| Grok 4.6 ',
              '| GPT-5 Fast | OpenAI | $9 | - | $1 | $30 | - |\n| Grok 4.6 ',
            ),
        }
      }
      return base(url, headers)
    }

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 40,
        overrides: new Map(),
        previousSnapshot: null,
      },
      'fixture',
    )

    expect(result.kind).toBe('ok')
    const snapshot = snapshotSchema.parse(JSON.parse(calls.writeFile[0]!.data))
    const row = snapshot.models.find((m) => m.cursorName === 'GPT-5 Fast')
    expect(row?.aaSlug).toBe('gpt-5')
    expect(row?.intelligence).not.toBeNull()
  })

  test('12 — a removed upstream model simply disappears, with no error', async () => {
    const { writer, calls } = createFakeWriter()
    const base = fixtureTransport(readFixture)
    const transport: Transport = async (url, headers) => {
      if (url.includes('/docs/models-and-pricing.md')) {
        const response = await base(url, headers)
        const markdown = await response.text()
        return {
          ...response,
          text: async () =>
            markdown
              .split('\n')
              .filter((line) => !line.startsWith('| [Kimi K3]'))
              .join('\n'),
        }
      }
      return base(url, headers)
    }

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 40,
        overrides: new Map(),
        previousSnapshot: null,
      },
      'fixture',
    )

    expect(result.kind).toBe('ok')
    const snapshot = snapshotSchema.parse(JSON.parse(calls.writeFile[0]!.data))
    expect(snapshot.models.some((m) => m.cursorName === 'Kimi K3')).toBe(false)
  })

  test('13 — an override replaces the derived mapping', async () => {
    const { deps, calls } = createFixtureDeps({
      overrides: new Map([
        ['Claude Opus 5', { aaSlug: 'gpt-5', reason: 'deliberately wrong, for the test' }],
      ]),
    })

    const result = await runRefresh(deps, 'fixture')

    expect(result.kind).toBe('ok')
    const snapshot = snapshotSchema.parse(JSON.parse(calls.writeFile[0]!.data))
    const row = snapshot.models.find((m) => m.cursorName === 'Claude Opus 5')
    expect(row?.aaSlug).toBe('gpt-5')
    expect(row?.aaVariantNote).toMatch(/override: deliberately wrong/)
  })

  test('14 — changes since the previous snapshot are reported, never fatal', async () => {
    const { deps: firstDeps, calls: firstCalls } = createFixtureDeps()
    await runRefresh(firstDeps, 'fixture')
    const previousSnapshot = snapshotSchema.parse(JSON.parse(firstCalls.writeFile[0]!.data))

    const { deps } = createFixtureDeps({
      previousSnapshot,
      overrides: new Map([['Claude Opus 5', { aaSlug: 'gpt-5', reason: 'remapped on purpose' }]]),
    })

    const result = await runRefresh(deps, 'fixture')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.changeLines.join('\n')).toMatch(/~ Claude Opus 5: claude-opus-5 -> gpt-5/)
    }
  })

  test('15 — an override for a model Cursor does not publish is reported, not fatal', async () => {
    const { deps } = createFixtureDeps({
      overrides: new Map([['Not A Real Model', { aaSlug: null, reason: 'stale entry' }]]),
    })

    const result = await runRefresh(deps, 'fixture')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.changeLines.join('\n')).toMatch(/Unused override: Not A Real Model/)
    }
  })

  test('10 — runRefresh contains no fixture-mode conditional', async () => {
    const source = await readFile(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.ts'),
      'utf-8',
    )
    const runRefreshMatch = /export async function runRefresh[\s\S]*?^}/m.exec(source)
    expect(runRefreshMatch).not.toBeNull()
    expect(runRefreshMatch![0]).not.toMatch(/if\s*\([^)]*fixture/i)
  })
})
