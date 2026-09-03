import type { Snapshot } from '@schema/snapshot'
import { hasChanges, type SnapshotChanges } from './changes'
import { SNAPSHOT_PATH } from './writeSnapshot'

/** Returns the lines to print. Pure — the caller does the printing. */
export function buildReport(
  snapshot: Snapshot,
  rateLimitRemaining: string | null,
): readonly string[] {
  // The snapshot's own coverage, not a recomputation: reporting a derived value would make
  // any disagreement between stored and derived structurally unobservable.
  const coverage = snapshot.coverage
  const unmatchedCount = snapshot.unmatched.length
  const lines: string[] = []

  lines.push(`Snapshot written: ${SNAPSHOT_PATH}`)
  lines.push(`Generated:        ${snapshot.generatedAt}`)
  lines.push(`AA index version: ${snapshot.source.aaIndexVersion}`)
  lines.push(
    `Rows:             ${coverage.totalRows} total · ${coverage.resolved} resolved · ${unmatchedCount} unmatched`,
  )
  lines.push(
    `Coverage:         intelligence ${coverage.intelligence}/${coverage.totalRows} · coding ${coverage.coding}/${coverage.totalRows} · agentic ${coverage.agentic}/${coverage.totalRows} · cost ${coverage.aaCostPerTask}/${coverage.totalRows}`,
  )

  if (unmatchedCount === 0) {
    lines.push('Unmatched (0): none')
  } else {
    lines.push(`Unmatched (${unmatchedCount}):`)
    for (const entry of snapshot.unmatched) {
      lines.push(`  - ${entry.cursorName} — ${entry.reason}`)
    }
  }

  if (rateLimitRemaining === null) {
    lines.push('AA rate limit remaining: unknown')
  } else {
    lines.push(`AA rate limit remaining: ${rateLimitRemaining}`)
  }

  return lines
}

function mappingLabel(slug: string | null): string {
  return slug ?? 'no AA record'
}

/** Returns the lines describing what moved since the previous snapshot, or [] when nothing
 *  did. Pure.
 *
 *  The Cursor -> AA mapping is derived fresh on every run, so this is what keeps that
 *  visible. Every line is informational: none of it requires the operator to do anything. */
export function buildChangeReport(
  changes: SnapshotChanges,
  unusedOverrides: readonly string[],
): readonly string[] {
  const lines: string[] = []

  if (hasChanges(changes)) {
    lines.push('Changes since the previous snapshot:')
    for (const name of changes.added) {
      lines.push(`  + ${name}`)
    }
    for (const name of changes.removed) {
      lines.push(`  - ${name} (no longer published by Cursor)`)
    }
    for (const change of changes.remapped) {
      lines.push(
        `  ~ ${change.cursorName}: ${mappingLabel(change.from)} -> ${mappingLabel(change.to)}`,
      )
    }
  }

  for (const name of unusedOverrides) {
    lines.push(`Unused override: ${name} is not in Cursor's catalogue — safe to delete.`)
  }

  return lines
}
