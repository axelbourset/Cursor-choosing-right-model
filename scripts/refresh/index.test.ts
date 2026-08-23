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
    const transport: Transport = async (url) => {
      if (url.includes('/language/models/free')) {
        return {
          status: 429,
          headers: {},
          json: async () => ({}),
          text: async () => '',
        }
      }
      throw new Error(`unexpected URL in 429 test: ${url}`)
    }

    const result = await runRefresh(
      {
        transport,
        files: writer,
        now: () => '2026-08-21T12:00:00.000Z',
        minExpectedAaModels: 40,
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
      },
      'fixture',
    )

    expect(result.kind).toBe('error')
    expect(calls.writeFile).toHaveLength(0)
  })

  test('6 — join throws stale-alias error: error matching /stale alias/, writeFile never called', async () => {
    const { writer, calls } = createFakeWriter()
    const base = fixtureTransport(readFixture)
    const transport: Transport = async (url, headers) => {
      if (url.includes('/language/models/free')) {
        const response = await base(url, headers)
        const envelope = (await response.json()) as {
          data: Array<{ slug: string }>
        }
        return {
          status: 200,
          headers: response.headers,
          json: async () => ({
            ...envelope,
            data: envelope.data.map((record) =>
              record.slug === 'grok-4-6' ? { ...record, slug: 'removed-slug' } : record,
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
      },
      'fixture',
    )

    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toMatch(/stale alias/)
    }
    expect(calls.writeFile).toHaveLength(0)
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

  test('10 — runRefresh contains no fixture-mode conditional', async () => {
    const source = await readFile(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.ts'),
      'utf-8',
    )
    const runRefreshMatch = source.match(/export async function runRefresh[\s\S]*?^}/m)
    expect(runRefreshMatch).not.toBeNull()
    expect(runRefreshMatch![0]).not.toMatch(/if\s*\([^)]*fixture/i)
  })
})
