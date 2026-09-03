import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { API_KEY_PLACEHOLDER, snapshotSchema } from '@schema/snapshot'

export type GuardViolation = { readonly path: string; readonly reason: string }

export type GuardInput = {
  /** From `git ls-files`. */
  readonly tracked: readonly string[]
  /** From walking `dist/`, empty when dist/ is absent. */
  readonly built: readonly string[]
}

const AA_INDEX_PATTERN = /artificial_analysis_\w*_index/

/** Two independent shapes. The first catches a key stored under a recognisable name; the
 *  second catches a long opaque token near ANY api-key-ish word, which is what a key baked
 *  into a bundle actually looks like — the original name-anchored pattern missed
 *  `"x-api-key":"sk-…"` entirely. */
const API_KEY_NAME_PATTERN = /aa[_-]?api[_-]?key\s*["']?\s*[:=]\s*["']?\S{16,}/i
const API_KEY_VALUE_PATTERN = /api[_-]?key["']?\s*[:=,]\s*["'][A-Za-z0-9_-]{20,}["']/i

/** Any module SPECIFIER naming the data directory, however it is written: static import,
 *  dynamic `import()`, `require`, and bare side-effect import, with `./`, `../`, `/` or an
 *  alias prefix. The previous pattern matched only `from '…/data/…'`.
 *
 *  Anchored on the import keyword on purpose: a bare string containing `data/` is a path
 *  constant, not a dependency — `schema/snapshot.ts` legitimately exports one. */
const DATA_IMPORT_PATTERN =
  /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"`](?:[^'"`]*[/@])?data\/[^'"`]*['"`]/

/** Read as text only where text is plausible; dist/ carries font and image binaries. */
const BINARY_EXTENSIONS =
  /\.(?:woff2?|ttf|eot|otf|png|jpe?g|gif|webp|avif|ico|mp4|webm|pdf|zip|gz)$/i

/** Field names as a bundler emits them: `cursorSlug:`, `"cursorSlug":` and `'cursorSlug':`
 *  all count. The previous check looked only for the double-quoted JSON form, which no
 *  bundler produces — a Vite chunk carrying all 49 models passed it silently. */
const SNAPSHOT_FIELD_PATTERNS = [/\bcursorSlug\b/g, /\baaVariantNote\b/g, /\bpriceCacheWrite\b/g]

/** A serialised catalogue repeats these once per model. Measured on this repo: the busiest
 *  legitimate source file (`join.ts`) reaches 8 and a hand-built test fixture 17, while a
 *  bundle carrying the snapshot hits 49 — so 20 separates them with room either side. */
const SNAPSHOT_FIELD_REPEAT_LIMIT = 20

/** Tests the pattern per line, skipping comment lines, so prose that quotes an import (this
 *  file's own doc comments included) is not mistaken for one. */
function hasDataImport(content: string): boolean {
  return content.split('\n').some((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return false
    }
    return DATA_IMPORT_PATTERN.test(line)
  })
}

function checkSnapshotShape(
  path: string,
  content: string,
  countRepeats: boolean,
): GuardViolation | null {
  for (const pattern of countRepeats ? SNAPSHOT_FIELD_PATTERNS : []) {
    const count = (content.match(pattern) ?? []).length
    if (count >= SNAPSHOT_FIELD_REPEAT_LIMIT) {
      return {
        path,
        reason: `repeats the snapshot field ${pattern.source} ${String(count)} times — looks like embedded catalogue data`,
      }
    }
  }

  try {
    const parsed: unknown = JSON.parse(content)
    if (snapshotSchema.safeParse(parsed).success) {
      return { path, reason: 'valid snapshot JSON' }
    }
  } catch {
    // not JSON — the repeat check above is what catches a bundled snapshot
  }

  return null
}

/** Pure. Caller supplies the file lists and a reader. */
export function findViolations(
  input: GuardInput,
  read: (path: string) => string,
): readonly GuardViolation[] {
  const violations: GuardViolation[] = []
  const trackedSet = new Set(input.tracked)
  const builtSet = new Set(input.built)
  const allPaths = [...new Set([...input.tracked, ...input.built])]

  for (const path of allPaths) {
    const isTracked = trackedSet.has(path)
    const isBuilt = builtSet.has(path)

    if (path.startsWith('public/') && path.endsWith('.json')) {
      violations.push({
        path,
        reason: 'snapshot JSON must not live under public/',
      })
      continue
    }

    if (BINARY_EXTENSIONS.test(path)) {
      continue
    }

    let content: string | undefined
    const getContent = (): string => {
      content ??= read(path)
      return content
    }

    // Applied to every tracked first-party source file, not just src/: domain/ and schema/
    // shipping the snapshot would be just as fatal, and dependency-cruiser does not cover it.
    if (
      isTracked &&
      /^(?:src|domain|schema)\//.test(path) &&
      /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path)
    ) {
      if (hasDataImport(getContent())) {
        violations.push({
          path,
          reason: 'first-party source must not import from data/',
        })
      }
    }

    if (isTracked && !path.startsWith('scripts/') && !path.startsWith('fixtures/')) {
      const trackedContent = getContent()
      if (AA_INDEX_PATTERN.test(trackedContent)) {
        violations.push({
          path,
          reason:
            'Artificial Analysis API field names must not appear outside scripts/ or fixtures/',
        })
      }
    }

    if (isTracked || isBuilt) {
      const keyContent = getContent().replaceAll(API_KEY_PLACEHOLDER, '')
      if (API_KEY_NAME_PATTERN.test(keyContent) || API_KEY_VALUE_PATTERN.test(keyContent)) {
        violations.push({
          path,
          reason: 'appears to contain an API key',
        })
      }
    }

    const checkSnapshot = isBuilt || (isTracked && !path.startsWith('fixtures/'))
    if (checkSnapshot) {
      // Test files legitimately build many rows by hand, so the repeat heuristic is for
      // build output and non-test source only. The JSON/schema check still applies to both.
      const countRepeats = isBuilt || !/\.test\.tsx?$/.test(path)
      const shapeViolation = checkSnapshotShape(path, getContent(), countRepeats)
      if (shapeViolation) {
        violations.push(shapeViolation)
      }
    }
  }

  return violations
}

function walkPublicJsonFiles(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) {
    return []
  }

  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const absolute = join(dir, entry)
    const relative = prefix ? `${prefix}/${entry}` : entry
    if (statSync(absolute).isDirectory()) {
      files.push(...walkPublicJsonFiles(absolute, relative))
      continue
    }
    if (entry.endsWith('.json')) {
      files.push(relative)
    }
  }

  return files
}

function walkBuiltFiles(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) {
    return []
  }

  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const absolute = join(dir, entry)
    const relative = prefix ? `${prefix}/${entry}` : entry
    if (statSync(absolute).isDirectory()) {
      files.push(...walkBuiltFiles(absolute, relative))
      continue
    }
    files.push(relative)
  }

  return files
}

function listTrackedFiles(): string[] {
  // `git ls-files` lists tracked paths, including files deleted in the worktree but not yet
  // staged. Reading those throws ENOENT, so filter to what actually exists on disk.
  const output = execSync('git ls-files', { encoding: 'utf-8' }).trim()
  if (!output) {
    return []
  }
  return output.split('\n').filter((file) => existsSync(file))
}

const GUARD_SELF_PATHS = new Set(['scripts/guard-no-data.ts', 'scripts/guard-no-data.test.ts'])

function runCli(): void {
  const tracked = [
    ...new Set([
      ...listTrackedFiles(),
      ...walkPublicJsonFiles('public').map((path) => `public/${path}`),
    ]),
  ].filter((path) => !GUARD_SELF_PATHS.has(path))
  const built = walkBuiltFiles('dist').map((path) => `dist/${path}`)
  const read = (path: string): string => readFileSync(path, 'utf-8')

  // The dist/ rules are half of this guard. Silently passing because dist/ is absent is how
  // a CI job can run the guard before the build and check nothing at all.
  if (!existsSync('dist')) {
    console.error('dist/ is absent — run `npm run build` before `npm run guard`')
    process.exit(1)
  }

  const violations = findViolations({ tracked, built }, read)
  if (violations.length === 0) {
    return
  }

  for (const violation of violations) {
    console.error(`${violation.path}: ${violation.reason}`)
  }
  process.exit(1)
}

const entryPath = fileURLToPath(import.meta.url)
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''

if (entryPath === invokedPath) {
  runCli()
}
