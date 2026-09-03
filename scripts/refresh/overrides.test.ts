import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { OverridesError, OVERRIDES_PATH, parseOverrides } from './overrides'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('parseOverrides', () => {
  test('1 — the checked-in overrides file is valid', async () => {
    // This is what replaces the compile-time check the old TypeScript table gave us.
    const raw: unknown = JSON.parse(await readFile(path.join(repoRoot, OVERRIDES_PATH), 'utf-8'))

    expect(() => parseOverrides(raw)).not.toThrow()
  })

  test('2 — an empty overrides map is valid; it is the normal state', () => {
    expect(parseOverrides({ overrides: {} }).size).toBe(0)
  })

  test('3 — the documentation keys are ignored', () => {
    const result = parseOverrides({ '//': ['docs'], '//example': { A: {} }, overrides: {} })

    expect(result.size).toBe(0)
  })

  test('3b — every //example entry is a valid override, and none is applied', async () => {
    // The examples are documentation, so they must stay copy-pasteable: validate each one
    // through the real schema by promoting it into `overrides`.
    const raw = JSON.parse(await readFile(path.join(repoRoot, OVERRIDES_PATH), 'utf-8')) as {
      '//example': Record<string, unknown>
    }

    expect(Object.keys(raw['//example']).length).toBeGreaterThan(0)
    expect(() => parseOverrides({ overrides: raw['//example'] })).not.toThrow()
    expect(parseOverrides(raw).size).toBe(0)
  })

  test('4 — a complete entry parses', () => {
    const result = parseOverrides({
      overrides: { 'Model A': { aaSlug: 'model-a-thinking', reason: 'rule picks the wrong tier' } },
    })

    expect(result.get('Model A')).toEqual({
      aaSlug: 'model-a-thinking',
      reason: 'rule picks the wrong tier',
    })
  })

  test('5 — aaSlug null is allowed, to force a model unresolved', () => {
    const result = parseOverrides({
      overrides: { 'Model A': { aaSlug: null, reason: 'AA benchmarks a different model' } },
    })

    expect(result.get('Model A')?.aaSlug).toBeNull()
  })

  test('6 — a missing reason is rejected, naming the file', () => {
    expect(() => parseOverrides({ overrides: { 'Model A': { aaSlug: 'x' } } })).toThrow(
      OverridesError,
    )
    expect(() => parseOverrides({ overrides: { 'Model A': { aaSlug: 'x' } } })).toThrow(
      /overrides\.json is invalid/,
    )
  })

  test('7 — an empty-string aaSlug is rejected; absent data must be null', () => {
    expect(() => parseOverrides({ overrides: { A: { aaSlug: '', reason: 'r' } } })).toThrow(
      OverridesError,
    )
  })

  test('8 — an unknown field is rejected rather than silently ignored', () => {
    // A misspelled key must not degrade into a missing override, which is what ADR-4 feared
    // about moving this data out of TypeScript.
    expect(() =>
      parseOverrides({ overrides: { A: { aaSlug: 'x', reason: 'r', allowNonReasonning: true } } }),
    ).toThrow(OverridesError)
  })

  test('9 — a missing overrides key is rejected', () => {
    expect(() => parseOverrides({})).toThrow(OverridesError)
  })

  test('10 — a typo at the document level is rejected, not silently empty', () => {
    // Without .strict() here the file parses clean and every override vanishes.
    const withTypo = { overides: { A: { aaSlug: 'x', reason: 'r' } }, overrides: {} }

    expect(() => parseOverrides(withTypo)).toThrow(OverridesError)
  })

  test('11 — an inherited key is not reported as an override', () => {
    const result = parseOverrides({ overrides: {} })

    expect(result.has('constructor')).toBe(false)
    expect(result.get('constructor')).toBeUndefined()
  })
})
