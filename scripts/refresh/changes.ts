import { z } from 'zod'
import type { Snapshot } from '@schema/snapshot'

/** Only the fields the diff reads, every newer one optional. Deliberately looser than
 *  `snapshotSchema`: a previous file written by an older schema version would fail that
 *  outright, and the first refresh after a version bump would then print no changes at all. */
export const previousSnapshotSchema = z.object({
  models: z.array(
    z.object({
      cursorName: z.string(),
      aaSlug: z.string().nullable(),
      cursorTokenRateEligible: z.boolean().optional(),
    }),
  ),
  cursorTokenRate: z.object({ usdPerMillionTokens: z.number() }).optional(),
})
/** What the diff needs from the previous run. A full `Snapshot` satisfies it. */
export type PreviousSnapshot = z.infer<typeof previousSnapshotSchema>

export type MappingChange = {
  readonly cursorName: string
  readonly from: string | null
  readonly to: string | null
}

/** A number that moved between runs. */
export type ValueChange = {
  readonly from: number
  readonly to: number
}

export type SnapshotChanges = {
  readonly added: readonly string[]
  readonly removed: readonly string[]
  /** Models whose AA record changed between runs. */
  readonly remapped: readonly MappingChange[]
  /** The Cursor Token Rate amount, when it moved. */
  readonly tokenRate: ValueChange | null
  /** Models that started paying the Cursor Token Rate. */
  readonly nowEligible: readonly string[]
  /** Models that stopped paying it. */
  readonly nowExempt: readonly string[]
}

export function hasChanges(changes: SnapshotChanges): boolean {
  return (
    changes.added.length > 0 ||
    changes.removed.length > 0 ||
    changes.remapped.length > 0 ||
    changes.tokenRate !== null ||
    changes.nowEligible.length > 0 ||
    changes.nowExempt.length > 0
  )
}

/** PURE. What moved since the previous snapshot.
 *
 *  The mapping is derived fresh every run, so this is what makes that visible: an added or
 *  removed model, or a model that now resolves to a different AA record than it did before.
 *  The Cursor Token Rate and its exclusion list are Cursor's to change at any time, so a new
 *  amount or a model flipping eligibility is reported too. A previous snapshot that predates
 *  those fields reports neither, rather than reporting every model as flipped.
 *  Informational — none of it is an error. */
export function diffSnapshots(
  previous: PreviousSnapshot | null,
  next: Pick<Snapshot, 'models' | 'cursorTokenRate'>,
): SnapshotChanges {
  if (previous === null) {
    return {
      added: [],
      removed: [],
      remapped: [],
      tokenRate: null,
      nowEligible: [],
      nowExempt: [],
    }
  }

  const before = new Map(previous.models.map((row) => [row.cursorName, row]))
  const after = new Map(next.models.map((row) => [row.cursorName, row]))

  const added = next.models
    .filter((row) => !before.has(row.cursorName))
    .map((row) => row.cursorName)
  const removed = previous.models
    .filter((row) => !after.has(row.cursorName))
    .map((row) => row.cursorName)

  const remapped: MappingChange[] = []
  const nowEligible: string[] = []
  const nowExempt: string[] = []
  for (const row of next.models) {
    const priorRow = before.get(row.cursorName)
    if (!priorRow) {
      continue
    }
    if (priorRow.aaSlug !== row.aaSlug) {
      remapped.push({ cursorName: row.cursorName, from: priorRow.aaSlug, to: row.aaSlug })
    }
    const wasEligible = priorRow.cursorTokenRateEligible
    if (wasEligible === false && row.cursorTokenRateEligible) {
      nowEligible.push(row.cursorName)
    } else if (wasEligible === true && !row.cursorTokenRateEligible) {
      nowExempt.push(row.cursorName)
    }
  }

  const priorRate = previous.cursorTokenRate?.usdPerMillionTokens
  const nextRate = next.cursorTokenRate.usdPerMillionTokens
  const tokenRate =
    priorRate !== undefined && priorRate !== nextRate ? { from: priorRate, to: nextRate } : null

  return { added, removed, remapped, tokenRate, nowEligible, nowExempt }
}
