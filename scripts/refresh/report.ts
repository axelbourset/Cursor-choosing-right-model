import type { Snapshot } from '@schema/snapshot'
import { computeCoverage } from '@domain/coverage'
import { SNAPSHOT_PATH } from './writeSnapshot'

/** Returns the lines to print. Pure — the caller does the printing. */
export function buildReport(
  snapshot: Snapshot,
  rateLimitRemaining: string | null,
): readonly string[] {
  const coverage = computeCoverage(snapshot.models)
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
