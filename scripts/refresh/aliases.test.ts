import { describe, expect, test } from 'vitest'
import { DECLARATIONS, type CursorModelDeclaration } from './aliases'

function findByCursorName(cursorName: string) {
  const row = DECLARATIONS.find((d) => d.cursorName === cursorName)
  if (!row) throw new Error(`No declaration for cursorName: ${cursorName}`)
  return row
}

describe('DECLARATIONS', () => {
  test('1 — DECLARATIONS.length is 47', () => {
    expect(DECLARATIONS.length).toBe(47)
  })

  test('2 — count where aaSlug === null is 4', () => {
    expect(DECLARATIONS.filter((d) => d.aaSlug === null).length).toBe(4)
  })

  test('3 — count where isAlias === true is 16', () => {
    expect(DECLARATIONS.filter((d) => d.isAlias === true).length).toBe(16)
  })

  test('4 — count where allowNonReasoning === true is 0', () => {
    const rows: readonly CursorModelDeclaration[] = DECLARATIONS
    expect(rows.filter((d) => d.allowNonReasoning === true).length).toBe(0)
  })

  test('5 — every cursorSlug is unique', () => {
    const slugs = DECLARATIONS.map((d) => d.cursorSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  test('6 — every cursorName is unique', () => {
    const names = DECLARATIONS.map((d) => d.cursorName)
    expect(new Set(names).size).toBe(names.length)
  })

  test("7 — aaSlug for cursorName 'GPT-5' is 'gpt-5'", () => {
    expect(findByCursorName('GPT-5').aaSlug).toBe('gpt-5')
  })

  test("8 — aaSlug for cursorName 'Claude 4 Sonnet' is 'claude-4-sonnet-thinking'", () => {
    expect(findByCursorName('Claude 4 Sonnet').aaSlug).toBe('claude-4-sonnet-thinking')
  })

  test("9 — aaSlug for cursorName 'Claude Opus 5' is 'claude-opus-5'", () => {
    expect(findByCursorName('Claude Opus 5').aaSlug).toBe('claude-opus-5')
  })

  test("10 — aaSlug for cursorName 'Composer 2.5' is null", () => {
    expect(findByCursorName('Composer 2.5').aaSlug).toBeNull()
  })

  test("11 — aaSlug for cursorName 'Gemini 3.1 Pro' is 'gemini-3-1-pro-preview'", () => {
    expect(findByCursorName('Gemini 3.1 Pro').aaSlug).toBe('gemini-3-1-pro-preview')
  })

  test("12 — aaSlug for cursorName 'GPT-5 Mini' is 'gpt-5-mini-medium'", () => {
    expect(findByCursorName('GPT-5 Mini').aaSlug).toBe('gpt-5-mini-medium')
  })

  test('13 — every row with isAlias === true has non-null aaSlug', () => {
    for (const row of DECLARATIONS) {
      if (row.isAlias) {
        expect(row.aaSlug).not.toBeNull()
      }
    }
  })

  test("14 — every row's note is a non-empty string", () => {
    for (const row of DECLARATIONS) {
      expect(typeof row.note).toBe('string')
      expect(row.note.length).toBeGreaterThan(0)
    }
  })
})
