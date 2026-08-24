import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { snapshotSchema } from '@schema/snapshot'

export type GuardViolation = { readonly path: string; readonly reason: string }

export type GuardInput = {
  /** From `git ls-files`. */
  readonly tracked: readonly string[]
  /** From walking `dist/`, empty when dist/ is absent. */
  readonly built: readonly string[]
}

const AA_INDEX_PATTERN = /artificial_analysis_\w*_index/
const API_KEY_PATTERN = /aa[_-]?api[_-]?key\s*[:=]\s*\S{16,}/i
const PLACEHOLDER = 'paste_your_key_here'
const DATA_IMPORT_PATTERN = /(?:import\s+[^'"]+\s+from|from)\s+['"](?:\.\.\/)*data\//

function checkSnapshotShape(path: string, content: string): GuardViolation | null {
  if (content.includes('"cursorSlug"') && content.includes('"aaVariantNote"')) {
    return {
      path,
      reason: 'contains serialized snapshot field names',
    }
  }

  try {
    const parsed: unknown = JSON.parse(content)
    if (snapshotSchema.safeParse(parsed).success) {
      return { path, reason: 'valid snapshot JSON' }
    }
  } catch {
    // not JSON — other rules may still apply
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

    let content: string | undefined
    const getContent = (): string => {
      content ??= read(path)
      return content
    }

    if (path.startsWith('src/')) {
      const srcContent = getContent()
      if (DATA_IMPORT_PATTERN.test(srcContent)) {
        violations.push({
          path,
          reason: 'src must not import from data/',
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
      const keyContent = getContent().replaceAll(PLACEHOLDER, '')
      if (API_KEY_PATTERN.test(keyContent)) {
        violations.push({
          path,
          reason: 'appears to contain an AA API key',
        })
      }
    }

    const checkSnapshot = isBuilt || (isTracked && !path.startsWith('fixtures/'))
    if (checkSnapshot) {
      const shapeViolation = checkSnapshotShape(path, getContent())
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
