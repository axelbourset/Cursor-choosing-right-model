import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { applyEnvFile, loadRepoEnv } from './loadEnv'

describe('applyEnvFile', () => {
  test('1 — sets unset keys from KEY=VALUE lines', () => {
    const env: Record<string, string | undefined> = {}
    applyEnvFile('AA_API_KEY=from-dotenv\n', env)
    expect(env.AA_API_KEY).toBe('from-dotenv')
  })

  test('2 — skips comments and blank lines', () => {
    const env: Record<string, string | undefined> = {}
    applyEnvFile('# comment\n\nAA_API_KEY=key\n', env)
    expect(env.AA_API_KEY).toBe('key')
  })

  test('3 — does not override an existing value', () => {
    const env: Record<string, string | undefined> = { AA_API_KEY: 'from-shell' }
    applyEnvFile('AA_API_KEY=from-dotenv\n', env)
    expect(env.AA_API_KEY).toBe('from-shell')
  })
})

describe('loadRepoEnv', () => {
  const original = process.env.AA_API_KEY

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AA_API_KEY
    } else {
      process.env.AA_API_KEY = original
    }
  })

  test('4 — reads .env from repo root when variable unset', async () => {
    delete process.env.AA_API_KEY
    const dir = await mkdtemp(path.join(os.tmpdir(), 'load-env-'))
    await writeFile(path.join(dir, '.env'), 'AA_API_KEY=dotenv-val\n', 'utf-8')

    await loadRepoEnv(dir)

    expect(process.env.AA_API_KEY).toBe('dotenv-val')
  })

  test('5 — missing .env is a no-op', async () => {
    delete process.env.AA_API_KEY
    const dir = await mkdtemp(path.join(os.tmpdir(), 'load-env-missing-'))

    await loadRepoEnv(dir)

    expect(process.env.AA_API_KEY).toBeUndefined()
  })
})
