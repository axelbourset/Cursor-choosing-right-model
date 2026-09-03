import type { ModelRow, Snapshot } from '@schema/snapshot'

export type MappingChange = {
  readonly cursorName: string
  readonly from: string | null
  readonly to: string | null
}

export type SnapshotChanges = {
  readonly added: readonly string[]
  readonly removed: readonly string[]
  /** Models whose AA record changed between runs. */
  readonly remapped: readonly MappingChange[]
}

export function hasChanges(changes: SnapshotChanges): boolean {
  return changes.added.length > 0 || changes.removed.length > 0 || changes.remapped.length > 0
}

/** PURE. What moved since the previous snapshot.
 *
 *  The mapping is derived fresh every run, so this is what makes that visible: an added or
 *  removed model, or a model that now resolves to a different AA record than it did before.
 *  Informational — none of it is an error. */
export function diffSnapshots(
  previous: Snapshot | null,
  next: readonly ModelRow[],
): SnapshotChanges {
  if (previous === null) {
    return { added: [], removed: [], remapped: [] }
  }

  const before = new Map(previous.models.map((row) => [row.cursorName, row]))
  const after = new Map(next.map((row) => [row.cursorName, row]))

  const added = next.filter((row) => !before.has(row.cursorName)).map((row) => row.cursorName)
  const removed = previous.models
    .filter((row) => !after.has(row.cursorName))
    .map((row) => row.cursorName)

  const remapped: MappingChange[] = []
  for (const row of next) {
    const priorRow = before.get(row.cursorName)
    if (priorRow && priorRow.aaSlug !== row.aaSlug) {
      remapped.push({ cursorName: row.cursorName, from: priorRow.aaSlug, to: row.aaSlug })
    }
  }

  return { added, removed, remapped }
}
