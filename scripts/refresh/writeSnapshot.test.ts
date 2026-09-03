import { describe, expect, test } from 'vitest'
import { snapshotSchema, type Snapshot } from '@schema/snapshot'
import {
  SNAPSHOT_PATH,
  SnapshotWriteError,
  writeSnapshot,
  type SnapshotFileWriter,
} from './writeSnapshot'

function validSnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-21T12:00:00.000Z',
    source: {
      aaIndexVersion: 1,
      attribution: 'Artificial Analysis (artificialanalysis.ai)',
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

type WriterCalls = {
  mkdir: string[]
  writeFile: { path: string; data: string }[]
  rename: { from: string; to: string }[]
  unlink: string[]
}

function createFakeWriter(
  overrides: Partial<{
    writeFile: SnapshotFileWriter['writeFile']
    rename: SnapshotFileWriter['rename']
    mkdir: SnapshotFileWriter['mkdir']
    unlink: SnapshotFileWriter['unlink']
  }> = {},
): { writer: SnapshotFileWriter; calls: WriterCalls } {
  const calls: WriterCalls = { mkdir: [], writeFile: [], rename: [], unlink: [] }

  const writer: SnapshotFileWriter = {
    mkdir: async (path) => {
      calls.mkdir.push(path)
      if (overrides.mkdir) return overrides.mkdir(path)
    },
    writeFile: async (path, data) => {
      calls.writeFile.push({ path, data })
      if (overrides.writeFile) return overrides.writeFile(path, data)
    },
    rename: async (from, to) => {
      calls.rename.push({ from, to })
      if (overrides.rename) return overrides.rename(from, to)
    },
    unlink: async (path) => {
      calls.unlink.push(path)
      if (overrides.unlink) return overrides.unlink(path)
    },
  }

  return { writer, calls }
}

describe('writeSnapshot', () => {
  test('1 — a valid snapshot', async () => {
    const { writer, calls } = createFakeWriter()

    await writeSnapshot(validSnapshot(), writer)

    // The temp name carries a pid and uuid so concurrent runs cannot collide, so assert the
    // shape and that write/rename agree on it rather than pinning a literal.
    expect(calls.writeFile).toHaveLength(1)
    const tmpPath = calls.writeFile[0]!.path
    expect(tmpPath).toMatch(/^data\/models\.json\.\d+\.[0-9a-f-]{36}\.tmp$/)
    expect(calls.writeFile[0]!.data).toBe(JSON.stringify(validSnapshot(), null, 2))
    expect(calls.rename).toEqual([{ from: tmpPath, to: 'data/models.json' }])
  })

  test('1b — two runs never share a temp path', async () => {
    const first = createFakeWriter()
    const second = createFakeWriter()

    await writeSnapshot(validSnapshot(), first.writer)
    await writeSnapshot(validSnapshot(), second.writer)

    expect(first.calls.writeFile[0]!.path).not.toBe(second.calls.writeFile[0]!.path)
  })

  test('1c — unknown fields are stripped, not written to disk', async () => {
    const { writer, calls } = createFakeWriter()
    const withExtra = { ...validSnapshot(), sneaky: 'value' } as unknown as Snapshot

    await writeSnapshot(withExtra, writer)

    expect(calls.writeFile[0]!.data).not.toContain('sneaky')
  })

  test('2 — call order in #1', async () => {
    const order: string[] = []
    const { writer } = createFakeWriter({
      writeFile: async () => {
        order.push('writeFile')
      },
      rename: async () => {
        order.push('rename')
      },
    })

    await writeSnapshot(validSnapshot(), writer)

    expect(order).toEqual(['writeFile', 'rename'])
  })

  test('3 — an invalid snapshot (schemaVersion: 2)', async () => {
    const { writer, calls } = createFakeWriter()
    const invalid = { ...validSnapshot(), schemaVersion: 2 as 1 }

    await expect(writeSnapshot(invalid, writer)).rejects.toThrow(SnapshotWriteError)
    expect(calls.writeFile).toHaveLength(0)
  })

  test('4 — an invalid snapshot (a model missing cursorSlug)', async () => {
    const { writer, calls } = createFakeWriter()
    const base = validSnapshot()
    const invalid = {
      ...base,
      models: [{ ...base.models[0]!, cursorSlug: '' }],
    }

    await expect(writeSnapshot(invalid, writer)).rejects.toThrow(SnapshotWriteError)
    expect(calls.writeFile).toHaveLength(0)
  })

  test('5 — writeFile rejects', async () => {
    const { writer, calls } = createFakeWriter({
      writeFile: async () => {
        throw new Error('disk full')
      },
    })

    await expect(writeSnapshot(validSnapshot(), writer)).rejects.toThrow(SnapshotWriteError)
    expect(calls.rename).toHaveLength(0)
    expect(calls.unlink).toEqual([calls.writeFile[0]!.path])
  })

  test('6 — rename rejects', async () => {
    const { writer, calls } = createFakeWriter({
      rename: async () => {
        throw new Error('rename failed')
      },
    })

    await expect(writeSnapshot(validSnapshot(), writer)).rejects.toThrow(SnapshotWriteError)
    expect(calls.unlink).toEqual([calls.writeFile[0]!.path])
  })

  test('7 — the written JSON', async () => {
    const snapshot = validSnapshot()
    const { writer, calls } = createFakeWriter()

    await writeSnapshot(snapshot, writer)

    const written = calls.writeFile[0]!.data
    expect(snapshotSchema.parse(JSON.parse(written))).toEqual(snapshot)
  })

  test('8 — the written path', async () => {
    const { writer, calls } = createFakeWriter()

    await writeSnapshot(validSnapshot(), writer)

    const paths = [
      ...calls.mkdir,
      ...calls.writeFile.map((entry) => entry.path),
      ...calls.rename.flatMap((entry) => [entry.from, entry.to]),
      ...calls.unlink,
    ]
    for (const path of paths) {
      expect(path).not.toContain('public/')
    }
  })

  test('9 — SNAPSHOT_PATH', () => {
    expect(SNAPSHOT_PATH).toBe('data/models.json')
  })
})
