import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeCoverage } from '@domain/coverage'
import {
  API_KEY_PLACEHOLDER,
  CURRENT_SCHEMA_VERSION,
  snapshotSchema,
  type Snapshot,
} from '@schema/snapshot'
import { diffSnapshots } from './changes'
import { fetchArtificialAnalysis } from './fetchArtificialAnalysis'
import { fetchCursorMarkdown } from './fetchCursorMarkdown'
import { fetchCursorPricingJson } from './fetchCursorPricingJson'
import { fixtureTransport } from './fixtureTransport'
import { loadRepoEnv } from './loadEnv'
import { joinModels } from './join'
import { parseOverrides, OVERRIDES_PATH, type Overrides } from './overrides'
import { parseCursorMarkdown } from './parseCursorMarkdown'
import { buildChangeReport, buildReport } from './report'
import { resolveDeclarations } from './resolve'
import type { Transport } from './transport'
import { writeSnapshot, SNAPSHOT_PATH, type SnapshotFileWriter } from './writeSnapshot'

/** Best-effort: a missing or unreadable previous snapshot just means "no changes to show". */
async function readPreviousSnapshot(snapshotPath: string): Promise<Snapshot | null> {
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(await readFile(snapshotPath, 'utf-8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type RefreshDeps = {
  readonly transport: Transport
  readonly files: SnapshotFileWriter
  readonly now: () => string
  /** Passed explicitly at the composition root — 100 in real mode, 40 in fixture mode. */
  readonly minExpectedAaModels: number
  /** Resolved repo root, so the snapshot is written where the previous one was read from. */
  readonly repoRoot: string
  /** Hand-written exceptions to the derived mapping. Normally empty. */
  readonly overrides: Overrides
  /** The snapshot on disk before this run, for change reporting. Null on a first run. */
  readonly previousSnapshot: Snapshot | null
}

export type RefreshOutcome =
  | {
      readonly kind: 'ok'
      readonly lines: readonly string[]
      /** What moved since the previous run. Informational; never affects the exit code. */
      readonly changeLines: readonly string[]
    }
  | { readonly kind: 'error'; readonly message: string }

export async function runRefresh(deps: RefreshDeps, apiKey: string): Promise<RefreshOutcome> {
  const { transport, files, now, minExpectedAaModels, overrides, previousSnapshot, repoRoot } = deps

  try {
    // Three independent hosts, so the AA pagination and the two Cursor documents overlap
    // rather than summing.
    const [aaResult, pricing, markdown] = await Promise.all([
      fetchArtificialAnalysis(apiKey, transport, minExpectedAaModels),
      fetchCursorPricingJson(transport),
      fetchCursorMarkdown(transport),
    ])
    const catalogue = parseCursorMarkdown(markdown)
    const resolved = resolveDeclarations(overrides, catalogue, aaResult.models)
    const joinResult = joinModels({
      declarations: resolved.declarations,
      catalogue,
      pricing,
      aaModels: aaResult.models,
    })
    const coverage = computeCoverage(joinResult.rows)
    const snapshot: Snapshot = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: now(),
      source: {
        aaIndexVersion: aaResult.indexVersion,
        attribution: 'Artificial Analysis (artificialanalysis.ai)',
      },
      coverage,
      unmatched: [...joinResult.unresolved],
      models: [...joinResult.rows],
    }
    await writeSnapshot(snapshot, files, repoRoot)
    const lines = buildReport(snapshot, aaResult.rateLimitRemaining)
    const changes = diffSnapshots(previousSnapshot, snapshot.models)
    return {
      kind: 'ok',
      lines,
      changeLines: buildChangeReport(changes, resolved.unusedOverrides),
    }
  } catch (error) {
    // Not JSON.stringify: it returns undefined for a function or symbol and throws on a
    // circular structure — inside a catch, which would turn a handled failure into a crash.
    const message = error instanceof Error ? error.message : String(error)
    const name = error instanceof Error ? error.name : 'UnknownError'
    return { kind: 'error', message: name === 'Error' ? message : `${name}: ${message}` }
  }
}

/** Node's fetch has no response timeout, so a hung upstream would hang the refresh — and
 *  CI — indefinitely. Every request gets one whether the caller passes a signal or not. */
const REQUEST_TIMEOUT_MS = 30_000

export const httpTransport: Transport = async (url, headers, signal) => {
  // Composed, not alternated: a caller-supplied signal adds cancellation, it must not
  // remove the deadline.
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const response = await fetch(url, {
    headers,
    signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
  })
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })
  return {
    status: response.status,
    headers: responseHeaders,
    json: () => response.json(),
    text: () => response.text(),
  }
}

async function main(): Promise<void> {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const useFixture = process.argv.includes('--fixture')

  let apiKey: string
  let transport: Transport
  let minExpectedAaModels: number

  if (useFixture) {
    apiKey = 'fixture'
    minExpectedAaModels = 40
    transport = fixtureTransport((relativePath) =>
      readFile(path.join(repoRoot, relativePath), 'utf-8'),
    )
  } else {
    await loadRepoEnv(repoRoot)
    const key = process.env.AA_API_KEY
    if (!key || key === API_KEY_PLACEHOLDER) {
      console.error('AA_API_KEY is required. Copy .env.example to .env and add your key.')
      process.exit(1)
    }
    apiKey = key
    minExpectedAaModels = 100
    transport = httpTransport
  }

  const files: SnapshotFileWriter = {
    writeFile: (filePath, data) => writeFile(filePath, data, 'utf-8').then(() => undefined),
    rename: (from, to) => rename(from, to).then(() => undefined),
    mkdir: (dirPath) => mkdir(dirPath, { recursive: true }).then(() => undefined),
    unlink: (filePath) => unlink(filePath).then(() => undefined),
  }

  const overrides = parseOverrides(
    JSON.parse(await readFile(path.join(repoRoot, OVERRIDES_PATH), 'utf-8')),
  )

  const result = await runRefresh(
    {
      transport,
      files,
      now: () => new Date().toISOString(),
      minExpectedAaModels,
      repoRoot,
      overrides,
      previousSnapshot: await readPreviousSnapshot(path.join(repoRoot, SNAPSHOT_PATH)),
    },
    apiKey,
  )

  if (result.kind === 'error') {
    console.error(result.message)
    process.exit(1)
  }

  for (const line of result.lines) {
    console.log(line)
  }

  for (const line of result.changeLines) {
    console.log(line)
  }
}

const entryPath = fileURLToPath(import.meta.url)
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (entryPath === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}
