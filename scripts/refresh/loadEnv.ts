import { readFile } from 'node:fs/promises'
import path from 'node:path'

type EnvRecord = Record<string, string | undefined>

export function applyEnvFile(content: string, env: EnvRecord = process.env): void {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equals = trimmed.indexOf('=')
    if (equals === -1) continue

    const key = trimmed.slice(0, equals).trim()
    const value = trimmed.slice(equals + 1).trim()
    if (key && env[key] === undefined) {
      env[key] = value
    }
  }
}

export async function loadRepoEnv(repoRoot: string): Promise<void> {
  try {
    const content = await readFile(path.join(repoRoot, '.env'), 'utf-8')
    applyEnvFile(content)
  } catch {
    // Missing .env is fine when the key is already in the environment.
  }
}
