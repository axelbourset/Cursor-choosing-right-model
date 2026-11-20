import type { Snapshot } from '@schema/snapshot'
import { hasChanges, type ScoreRegressions, type SnapshotChanges } from './changes'
import { CURSOR_FIRST_PARTY_PROVIDER } from './cursorTokenRate'
import { SNAPSHOT_PATH } from './writeSnapshot'

/** One line: the amount, who pays it, and why the rest do not. The exempt third-party models
 *  are named because Cursor publishes a price threshold, not a list: this line is the only
 *  place the operator sees which models it caught. */
function tokenRateLine(snapshot: Snapshot): string {
  const rate = snapshot.cursorTokenRate
  const eligible = snapshot.models.filter((row) => row.cursorTokenRateEligible).length
  const exempt = snapshot.models.filter((row) => !row.cursorTokenRateEligible)
  const firstParty = exempt.filter((row) => row.provider === CURSOR_FIRST_PARTY_PROVIDER).length
  const cheap = exempt
    .filter((row) => row.provider !== CURSOR_FIRST_PARTY_PROVIDER)
    .map((row) => row.cursorName)
  const names = cheap.length === 0 ? '' : `: ${cheap.join(', ')}`
  return `Token rate:       $${rate.usdPerMillionTokens} / 1M tokens · ${eligible} eligible · ${exempt.length} exempt (${firstParty} Cursor, ${cheap.length} cache read < $${rate.exemptCacheReadBelowUsdPerMillionTokens}${names})`
}

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

  lines.push(tokenRateLine(snapshot))

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
    if (changes.tokenRate) {
      lines.push(
        `  ~ Cursor Token Rate: $${changes.tokenRate.from} -> $${changes.tokenRate.to} per 1M tokens`,
      )
    }
    for (const name of changes.nowEligible) {
      lines.push(`  ~ ${name}: now pays the Cursor Token Rate`)
    }
    for (const name of changes.nowExempt) {
      lines.push(`  ~ ${name}: now exempt from the Cursor Token Rate`)
    }
  }

  for (const name of unusedOverrides) {
    lines.push(`Unused override: ${name} is not in Cursor's catalogue — safe to delete.`)
  }

  return lines
}

/** Returns warning lines for upstream shifts that degrade the snapshot without failing the
 *  run, or [] when there are none. Pure. `withoutCacheRead` names the third-party models
 *  counted as paying the Cursor Token Rate only because they have no cache-read price. */
export function buildWarnings(
  regressions: ScoreRegressions,
  withoutCacheRead: readonly string[],
): readonly string[] {
  const lines: string[] = []

  if (regressions.indexVersion) {
    const { from, to } = regressions.indexVersion
    lines.push(
      `WARNING: Artificial Analysis index version changed ${from} -> ${to}. Scores from different index versions are not comparable, and models AA has not re-benchmarked may have lost theirs.`,
    )
  }

  if (regressions.resolved) {
    const { from, to } = regressions.resolved
    const drop = Math.round(((from - to) / from) * 100)
    lines.push(
      `WARNING: matched models fell from ${from} to ${to} (-${drop}%) since the previous snapshot. Check the unmatched list above before using this snapshot.`,
    )
  }

  if (withoutCacheRead.length > 0) {
    lines.push(
      `WARNING: no cache-read price for ${withoutCacheRead.join(', ')}. The Cursor Token Rate exemption can't be checked without one, so each is counted as paying the rate. Check them on Cursor's pricing page.`,
    )
  }

  return lines
}
