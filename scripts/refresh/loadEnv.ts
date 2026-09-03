import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type EnvRecord = Record<string, string | undefined>

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Strips one matched pair of surrounding quotes, and an unquoted trailing `# comment`.
 *  A quoted value keeps its `#` — `"a # b"` is the literal `a # b`. */
function parseValue(raw: string): string {
  const trimmed = raw.trim()

  const quote = trimmed.startsWith('"') ? '"' : trimmed.startsWith("'") ? "'" : null
  if (quote !== null && trimmed.length >= 2 && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1)
  }

  const comment = trimmed.indexOf(' #')
  return comment === -1 ? trimmed : trimmed.slice(0, comment).trim()
}

/** Applies `KEY=value` lines to `env`, without overwriting anything already set.
 *
 *  Deliberately forgiving about the shapes people actually write in a .env — quoted
 *  values, a leading `export`, a trailing comment — because the failure mode otherwise is
 *  an opaque HTTP 401, or "AA_API_KEY is required" printed to someone looking straight at
 *  the key in their file. A line whose key is still not an identifier is skipped rather
 *  than written under a nonsense name. */
export function applyEnvFile(content: string, env: EnvRecord = process.env): void {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equals = trimmed.indexOf('=')
    if (equals === -1) continue

    const rawKey = trimmed.slice(0, equals).trim()
    const key = rawKey.startsWith('export ') ? rawKey.slice('export '.length).trim() : rawKey
    if (!KEY_PATTERN.test(key)) continue

    env[key] ??= parseValue(trimmed.slice(equals + 1))
  }
}

export async function loadRepoEnv(repoRoot: string): Promise<void> {
  try {
    const content = await readFile(path.join(repoRoot, '.env'), 'utf-8')
    applyEnvFile(content)
  } catch (error) {
    // A missing .env is fine — the key may already be in the environment. Anything else
    // (EACCES, EISDIR) is a real problem the operator needs to see.
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw error
    }
  }
}
