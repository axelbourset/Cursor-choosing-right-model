import { randomUUID } from 'node:crypto'
import { snapshotSchema, SNAPSHOT_PATH, type Snapshot } from '@schema/snapshot'

export { SNAPSHOT_PATH }

export type SnapshotFileWriter = {
  readonly writeFile: (path: string, data: string) => Promise<void>
  readonly rename: (from: string, to: string) => Promise<void>
  readonly mkdir: (path: string) => Promise<void>
  readonly unlink: (path: string) => Promise<void>
}
export class SnapshotWriteError extends Error {
  override name = 'SnapshotWriteError'
}

const DATA_DIR = 'data'

/** Validates, writes to a unique temp file, then renames over `SNAPSHOT_PATH`.
 *
 *  The temp name carries a pid and uuid so two overlapping refreshes cannot rename each
 *  other's half-written file into place — write-then-rename is atomic against a reader,
 *  but not against a second writer. */
export async function writeSnapshot(snapshot: Snapshot, files: SnapshotFileWriter): Promise<void> {
  const parsed = snapshotSchema.safeParse(snapshot)
  if (!parsed.success) {
    throw new SnapshotWriteError('snapshot failed validation', { cause: parsed.error })
  }

  const tmpPath = `${SNAPSHOT_PATH}.${String(process.pid)}.${randomUUID()}.tmp`

  try {
    await files.mkdir(DATA_DIR)
    // parsed.data, not the argument: zod strips unknown keys, so serialising the raw input
    // would put fields on disk that validation never saw.
    await files.writeFile(tmpPath, JSON.stringify(parsed.data, null, 2))
    await files.rename(tmpPath, SNAPSHOT_PATH)
  } catch (error) {
    try {
      await files.unlink(tmpPath)
    } catch {
      // Best-effort cleanup of a partial temp file.
    }
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    throw new SnapshotWriteError(message, { cause: error })
  }
}
