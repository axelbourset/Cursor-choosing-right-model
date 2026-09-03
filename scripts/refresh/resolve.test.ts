import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import type { AaModel } from './fetchArtificialAnalysis'
import { parseCursorMarkdown, type CursorCatalogueRow } from './parseCursorMarkdown'
import { resolveDeclarations } from './resolve'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')

async function loadAaFixture(): Promise<AaModel[]> {
  const models: AaModel[] = []
  for (const page of [1, 2]) {
    const body = JSON.parse(
      await readFile(path.join(fixturesDir, `aa-free-page-${page}.synthetic.json`), 'utf-8'),
    ) as { data: { slug: string; name: string; evaluations: Record<string, number | null> }[] }
    for (const record of body.data) {
      models.push({
        slug: record.slug,
        name: record.name,
        intelligence: record.evaluations.artificial_analysis_intelligence_index ?? null,
        coding: record.evaluations.artificial_analysis_coding_index ?? null,
        agentic: record.evaluations.artificial_analysis_agentic_index ?? null,
        costPerTask: null,
      })
    }
  }
  return models
}

async function loadCatalogue(): Promise<readonly CursorCatalogueRow[]> {
  return parseCursorMarkdown(
    await readFile(path.join(fixturesDir, 'cursor-models.fixture.md'), 'utf-8'),
  )
}

function slugFor(
  declarations: ReturnType<typeof resolveDeclarations>['declarations'],
  cursorName: string,
): string | null {
  const found = declarations.find((d) => d.cursorName === cursorName)
  if (!found) {
    throw new Error(`no declaration for ${cursorName}`)
  }
  return found.aaSlug
}

describe('resolveDeclarations', () => {
  test('1 — every catalogue row gets exactly one declaration, in order', async () => {
    const catalogue = await loadCatalogue()

    const { declarations } = resolveDeclarations(new Map(), catalogue, await loadAaFixture())

    expect(declarations).toHaveLength(catalogue.length)
    expect(declarations.map((d) => d.cursorName)).toEqual(catalogue.map((r) => r.name))
  })

  // Tests 2-7 pin the ADR-9 variant decisions that the hand-written table used to assert.
  // They now assert the RULE reproduces them, which is what actually has to keep holding.

  test('2 — an exact slug match resolves to itself', async () => {
    const { declarations } = resolveDeclarations(
      new Map(),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(slugFor(declarations, 'GPT-5')).toBe('gpt-5')
    expect(slugFor(declarations, 'Claude Opus 5')).toBe('claude-opus-5')
  })

  test('3 — a reasoning variant is preferred over the bare slug', async () => {
    const { declarations } = resolveDeclarations(
      new Map(),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(slugFor(declarations, 'Claude 4 Sonnet')).toBe('claude-4-sonnet-thinking')
  })

  test('4 — Cursor packaging suffixes fall back to the underlying model', async () => {
    const { declarations } = resolveDeclarations(
      new Map(),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(slugFor(declarations, 'GPT-5 Fast')).toBe('gpt-5')
    expect(slugFor(declarations, 'Grok 4.6 (Fast)')).toBe('grok-4-6')
    expect(slugFor(declarations, 'Claude 4 Sonnet 1M')).toBe('claude-4-sonnet-thinking')
    expect(slugFor(declarations, 'Claude Opus 4.7 (fast mode)')).toBe('claude-opus-4-7')
  })

  test('5 — the Cursor/Anthropic word-order flip resolves', async () => {
    const { declarations } = resolveDeclarations(
      new Map(),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(slugFor(declarations, 'Claude 4.5 Opus')).toBe('claude-opus-4-5-thinking')
    expect(slugFor(declarations, 'Claude 4.6 Sonnet')).toBe('claude-sonnet-4-6-adaptive')
  })

  test('6 — a model AA has never benchmarked resolves to null, not a guess', async () => {
    const { declarations } = resolveDeclarations(
      new Map(),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(slugFor(declarations, 'Composer 2.5')).toBeNull()
    expect(slugFor(declarations, 'GPT-5.1 Codex Max')).toBeNull()
  })

  test('7 — every resolved declaration names a slug that exists in the payload', async () => {
    const aaModels = await loadAaFixture()
    const slugs = new Set(aaModels.map((m) => m.slug))

    const { declarations } = resolveDeclarations(new Map(), await loadCatalogue(), aaModels)

    for (const declaration of declarations) {
      if (declaration.aaSlug !== null) {
        expect(slugs.has(declaration.aaSlug)).toBe(true)
      }
    }
  })

  test('8 — an override replaces the derived mapping and records why', async () => {
    const { declarations } = resolveDeclarations(
      new Map([['GPT-5', { aaSlug: 'gpt-5-mini-medium', reason: 'deliberate' }]]),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    const row = declarations.find((d) => d.cursorName === 'GPT-5')
    expect(row?.aaSlug).toBe('gpt-5-mini-medium')
    expect(row?.origin).toBe('override')
    expect(row?.note).toBe('override: deliberate')
  })

  test('9 — an override can force a model unresolved', async () => {
    const { declarations } = resolveDeclarations(
      new Map([['GPT-5', { aaSlug: null, reason: 'AA benchmarks a different build' }]]),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(slugFor(declarations, 'GPT-5')).toBeNull()
  })

  test('10 — an override for a model Cursor does not publish is reported, not applied', async () => {
    const { declarations, unusedOverrides } = resolveDeclarations(
      new Map([['Ghost Model', { aaSlug: 'gpt-5', reason: 'stale' }]]),
      await loadCatalogue(),
      await loadAaFixture(),
    )

    expect(unusedOverrides).toEqual(['Ghost Model'])
    expect(declarations.some((d) => d.cursorName === 'Ghost Model')).toBe(false)
  })

  test('10b — a model named after an Object prototype key is not treated as overridden', async () => {
    const catalogue = [
      {
        name: 'constructor',
        provider: 'OpenAI',
        hidden: false,
        input: 1,
        output: 2,
        cacheRead: null,
        cacheWrite: null,
      },
    ]

    const { declarations } = resolveDeclarations(new Map(), catalogue, await loadAaFixture())

    expect(declarations[0]!.origin).toBe('auto')
    expect(declarations[0]!.aaSlug).toBeNull()
  })

  test('11 — a brand-new upstream model needs no human action', async () => {
    const catalogue = [
      ...(await loadCatalogue()),
      {
        name: 'GPT-5 Turbo Fast',
        provider: 'OpenAI',
        hidden: false,
        input: 1,
        output: 2,
        cacheRead: null,
        cacheWrite: null,
      },
    ]

    const { declarations } = resolveDeclarations(new Map(), catalogue, await loadAaFixture())

    expect(declarations).toHaveLength(catalogue.length)
    expect(slugFor(declarations, 'GPT-5 Turbo Fast')).toBeNull()
  })
})
