import type { ZodError } from 'zod'
import type { Snapshot } from '@schema/snapshot'
import { CURRENT_SCHEMA_VERSION, snapshotSchema } from '@schema/snapshot'

export type SnapshotSource = 'dropped' | 'local'
export type LoadResult =
  | { readonly kind: 'ok'; readonly snapshot: Snapshot; readonly source: SnapshotSource }
  /** Before the first resolution completes. Distinct from `empty`, which is a real answer:
   *  rendering the onboarding guide during this state flashes it at returning users. */
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly errors: readonly string[] }
  | { readonly kind: 'stale'; readonly found: number; readonly expected: number }

export const STORAGE_KEY = 'cursor-model-picker:snapshot'

export type StoragePort = {
  readonly get: (key: string) => string | null
  readonly set: (key: string, value: string) => void
  readonly remove: (key: string) => void
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.')
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message
  })
}

function staleIfNeeded(parsed: unknown): LoadResult | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const schemaVersion = 'schemaVersion' in parsed ? parsed.schemaVersion : undefined
  if (typeof schemaVersion === 'number' && schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { kind: 'stale', found: schemaVersion, expected: CURRENT_SCHEMA_VERSION }
  }
  return null
}

/** Parses and validates one JSON string. Never throws. */
export function parseSnapshot(raw: string, source: SnapshotSource): LoadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'invalid', errors: [message] }
  }

  const stale = staleIfNeeded(parsed)
  if (stale !== null) {
    return stale
  }

  const result = snapshotSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'invalid', errors: formatZodErrors(result.error) }
  }

  return { kind: 'ok', snapshot: result.data, source }
}

/** Full resolution. `fetchLocal` returns null when the dev server has no file. */
export async function loadSnapshot(
  storage: StoragePort,
  fetchLocal: () => Promise<string | null>,
): Promise<LoadResult> {
  const stored = storage.get(STORAGE_KEY)
  if (stored !== null) {
    const dropped = parseSnapshot(stored, 'dropped')
    if (dropped.kind === 'ok') {
      return dropped
    }
    if (dropped.kind === 'invalid' || dropped.kind === 'stale') {
      const localRaw = await fetchLocal()
      if (localRaw !== null) {
        const local = parseSnapshot(localRaw, 'local')
        if (local.kind === 'ok') {
          return local
        }
      }
      return dropped
    }
  }

  const localRaw = await fetchLocal()
  if (localRaw !== null) {
    return parseSnapshot(localRaw, 'local')
  }

  return { kind: 'empty' }
}

/** Validates, and only on success writes to storage. Returns the result either way. */
export function storeDroppedSnapshot(raw: string, storage: StoragePort): LoadResult {
  const result = parseSnapshot(raw, 'dropped')
  if (result.kind === 'ok') {
    storage.set(STORAGE_KEY, raw)
  }
  return result
}

export function clearStoredSnapshot(storage: StoragePort): void {
  storage.remove(STORAGE_KEY)
}
