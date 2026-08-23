import type { Snapshot } from '@schema/snapshot'
import { snapshotSchema } from '@schema/snapshot'

export type SnapshotFileWriter = {
  readonly writeFile: (path: string, data: string) => Promise<void>
  readonly rename: (from: string, to: string) => Promise<void>
  readonly mkdir: (path: string) => Promise<void>
  readonly unlink: (path: string) => Promise<void>
}
export class SnapshotWriteError extends Error {}

export const SNAPSHOT_PATH = 'data/models.json'

const TMP_PATH = `${SNAPSHOT_PATH}.tmp`
const DATA_DIR = 'data'

/** Validates, writes to `${SNAPSHOT_PATH}.tmp`, then renames. */
export async function writeSnapshot(snapshot: Snapshot, files: SnapshotFileWriter): Promise<void> {
  const parsed = snapshotSchema.safeParse(snapshot)
  if (!parsed.success) {
    throw new SnapshotWriteError(parsed.error.message)
  }

  try {
    await files.mkdir(DATA_DIR)
    await files.writeFile(TMP_PATH, JSON.stringify(snapshot, null, 2))
    await files.rename(TMP_PATH, SNAPSHOT_PATH)
  } catch (error) {
    try {
      await files.unlink(TMP_PATH)
    } catch {
      // Best-effort cleanup of a partial temp file.
    }
    if (error instanceof SnapshotWriteError) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new SnapshotWriteError(message, { cause: error })
  }
}
