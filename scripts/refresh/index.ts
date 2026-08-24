import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeCoverage } from '@domain/coverage'
import type { Snapshot } from '@schema/snapshot'
import { DECLARATIONS } from './aliases'
import { fetchArtificialAnalysis } from './fetchArtificialAnalysis'
import { fetchCursorMarkdown } from './fetchCursorMarkdown'
import { fetchCursorPricingJson } from './fetchCursorPricingJson'
import { fixtureTransport } from './fixtureTransport'
import { loadRepoEnv } from './loadEnv'
import { joinModels } from './join'
import { parseCursorMarkdown } from './parseCursorMarkdown'
import { buildReport } from './report'
import type { Transport } from './transport'
import { writeSnapshot, type SnapshotFileWriter } from './writeSnapshot'

export type RefreshDeps = {
  readonly transport: Transport
  readonly files: SnapshotFileWriter
  readonly now: () => string
  /** Passed explicitly at the composition root — 100 in real mode, 40 in fixture mode. */
  readonly minExpectedAaModels: number
}

export type RefreshOutcome =
  | { readonly kind: 'ok'; readonly lines: readonly string[] }
  | { readonly kind: 'error'; readonly message: string }

export async function runRefresh(deps: RefreshDeps, apiKey: string): Promise<RefreshOutcome> {
  const { transport, files, now, minExpectedAaModels } = deps

  try {
    const aaResult = await fetchArtificialAnalysis(apiKey, transport, minExpectedAaModels)
    const pricing = await fetchCursorPricingJson(transport)
    const markdown = await fetchCursorMarkdown(transport)
    const catalogue = parseCursorMarkdown(markdown, 47)
    const joinResult = joinModels({
      declarations: DECLARATIONS,
      catalogue,
      pricing,
      aaModels: aaResult.models,
    })
    const coverage = computeCoverage(joinResult.rows)
    const snapshot: Snapshot = {
      schemaVersion: 1,
      generatedAt: now(),
      source: {
        aaIndexVersion: aaResult.indexVersion,
        attribution: 'Artificial Analysis (artificialanalysis.ai)',
      },
      coverage,
      unmatched: [...joinResult.unresolved],
      models: [...joinResult.rows],
    }
    await writeSnapshot(snapshot, files)
    const lines = buildReport(snapshot, aaResult.rateLimitRemaining)
    return { kind: 'ok', lines }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'error', message }
  }
}

const httpTransport: Transport = async (url, headers) => {
  const response = await fetch(url, { headers })
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
    if (!key || key === 'paste_your_key_here') {
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

  const result = await runRefresh(
    { transport, files, now: () => new Date().toISOString(), minExpectedAaModels },
    apiKey,
  )

  if (result.kind === 'error') {
    console.error(result.message)
    process.exit(1)
  }

  for (const line of result.lines) {
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
