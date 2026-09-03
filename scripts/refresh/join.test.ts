import { describe, expect, test } from 'vitest'
import type { CursorModelDeclaration } from './declaration'
import type { AaModel } from './fetchArtificialAnalysis'
import type { CursorPrice } from './fetchCursorPricingJson'
import { JoinError, joinModels } from './join'
import type { CursorCatalogueRow } from './parseCursorMarkdown'

function decl(
  overrides: Partial<CursorModelDeclaration> &
    Pick<CursorModelDeclaration, 'cursorName' | 'cursorSlug'>,
): CursorModelDeclaration {
  return {
    aaSlug: 'fixture-aa',
    allowNonReasoning: false,
    note: 'test note',
    origin: 'auto',
    ...overrides,
  }
}

function catalogue(
  overrides: Partial<CursorCatalogueRow> & Pick<CursorCatalogueRow, 'name'>,
): CursorCatalogueRow {
  return {
    provider: 'Fixture Provider',
    hidden: false,
    input: 1,
    output: 2,
    cacheRead: 0.1,
    cacheWrite: 0.5,
    ...overrides,
  }
}

function aaModel(overrides: Partial<AaModel> & Pick<AaModel, 'slug'>): AaModel {
  return {
    name: 'Fixture Model',
    intelligence: 50,
    coding: 60,
    agentic: 40,
    costPerTask: 0.5,
    ...overrides,
  }
}

function pricing(overrides: Partial<CursorPrice> & Pick<CursorPrice, 'slug'>): CursorPrice {
  return {
    name: 'Fixture',
    provider: 'Pricing Provider',
    hidden: true,
    input: 10,
    output: 20,
    cacheRead: 1,
    cacheWrite: 5,
    ...overrides,
  }
}

function expectJoinError(fn: () => unknown, pattern: RegExp) {
  expect(() => fn()).toThrow(JoinError)
  expect(() => fn()).toThrow(pattern)
}

describe('joinModels', () => {
  test('1 — 1 declaration, matching catalogue row, matching AA record', () => {
    const declarations = [
      decl({ cursorName: 'Model A', cursorSlug: 'model-a', aaSlug: 'aa-a', note: 'provenance' }),
    ]
    const catalogueRows = [catalogue({ name: 'Model A', provider: 'Anthropic', hidden: false })]
    const pricingRows = [pricing({ slug: 'model-a' })]
    const aaModels = [aaModel({ slug: 'aa-a', name: 'AA Model A' })]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: pricingRows,
      aaModels,
    })

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]!
    expect(row.cursorName).toBe('Model A')
    expect(row.cursorSlug).toBe('model-a')
    expect(row.provider).toBe('Anthropic')
    expect(row.hidden).toBe(false)
    expect(row.aaSlug).toBe('aa-a')
    expect(row.aaName).toBe('AA Model A')
    expect(row.intelligence).toBe(50)
    expect(row.coding).toBe(60)
    expect(row.agentic).toBe(40)
    expect(row.aaCostPerTask).toBe(0.5)
    expect(row.priceInput).toBe(10)
    expect(row.priceOutput).toBe(20)
    expect(row.priceCacheRead).toBe(1)
    expect(row.priceCacheWrite).toBe(5)
    expect(row.aaVariantNote).toBe('provenance')
    expect(result.unresolved).toHaveLength(0)
  })

  test("2 — declaration with aaSlug: null carries the declaration's own reason", () => {
    const declarations = [
      decl({
        cursorName: 'Unbenchmarked',
        cursorSlug: 'unbenchmarked',
        aaSlug: null,
        note: 'no AA record in the unbenchmarked family',
      }),
    ]
    const catalogueRows = [catalogue({ name: 'Unbenchmarked' })]
    const pricingRows = [pricing({ slug: 'unbenchmarked' })]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: pricingRows,
      aaModels: [],
    })

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]!
    expect(row.aaSlug).toBeNull()
    expect(row.aaName).toBeNull()
    expect(row.intelligence).toBeNull()
    expect(row.coding).toBeNull()
    expect(row.agentic).toBeNull()
    expect(row.aaCostPerTask).toBeNull()
    expect(row.priceInput).toBe(10)
    expect(result.unresolved).toHaveLength(1)
    expect(result.unresolved[0]).toEqual({
      cursorName: 'Unbenchmarked',
      reason: 'no AA record in the unbenchmarked family',
    })
  })

  test('3 — catalogue row not in the declaration set', () => {
    const declarations = [decl({ cursorName: 'Model A', cursorSlug: 'model-a' })]
    const catalogueRows = [catalogue({ name: 'Model A' }), catalogue({ name: 'Orphan Row' })]

    expectJoinError(
      () =>
        joinModels({
          declarations,
          catalogue: catalogueRows,
          pricing: [],
          aaModels: [aaModel({ slug: 'fixture-aa' })],
        }),
      /Orphan Row/,
    )
  })

  test('4 — declaration whose catalogue row is missing', () => {
    const declarations = [decl({ cursorName: 'Missing Model', cursorSlug: 'missing-model' })]

    expectJoinError(
      () =>
        joinModels({
          declarations,
          catalogue: [],
          pricing: [],
          aaModels: [aaModel({ slug: 'fixture-aa' })],
        }),
      /Missing Model/,
    )
  })

  test('5 — declaration aaSlug absent from aaModels', () => {
    const declarations = [
      decl({ cursorName: 'Model A', cursorSlug: 'model-a', aaSlug: 'dead-slug' }),
    ]

    expectJoinError(
      () =>
        joinModels({
          declarations,
          catalogue: [catalogue({ name: 'Model A' })],
          pricing: [pricing({ slug: 'model-a' })],
          aaModels: [aaModel({ slug: 'other-slug' })],
        }),
      /stale alias/,
    )
  })

  test('6 — AA record named Fixture Model 99 (Non-reasoning), allowNonReasoning: false', () => {
    const declarations = [
      decl({
        cursorName: 'Model A',
        cursorSlug: 'model-a',
        aaSlug: 'nr-slug',
        allowNonReasoning: false,
      }),
    ]

    expectJoinError(
      () =>
        joinModels({
          declarations,
          catalogue: [catalogue({ name: 'Model A' })],
          pricing: [pricing({ slug: 'model-a' })],
          aaModels: [aaModel({ slug: 'nr-slug', name: 'Fixture Model 99 (Non-reasoning)' })],
        }),
      /non-reasoning/i,
    )
  })

  test('7 — same but allowNonReasoning: true', () => {
    const declarations = [
      decl({
        cursorName: 'Model A',
        cursorSlug: 'model-a',
        aaSlug: 'nr-slug',
        allowNonReasoning: true,
      }),
    ]

    const result = joinModels({
      declarations,
      catalogue: [catalogue({ name: 'Model A' })],
      pricing: [pricing({ slug: 'model-a' })],
      aaModels: [aaModel({ slug: 'nr-slug', name: 'Fixture Model 99 (Non-reasoning)' })],
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.aaName).toBe('Fixture Model 99 (Non-reasoning)')
    expect(result.unresolved).toHaveLength(0)
  })

  test('8 — pricing.json has the slug', () => {
    const declarations = [decl({ cursorName: 'Model A', cursorSlug: 'model-a' })]
    const catalogueRows = [
      catalogue({ name: 'Model A', input: 99, output: 99, cacheRead: 99, cacheWrite: 99 }),
    ]
    const pricingRows = [
      pricing({ slug: 'model-a', input: 3, output: 4, cacheRead: 0.3, cacheWrite: 1.5 }),
    ]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: pricingRows,
      aaModels: [aaModel({ slug: 'fixture-aa' })],
    })

    const row = result.rows[0]!
    expect(row.priceInput).toBe(3)
    expect(row.priceOutput).toBe(4)
    expect(row.priceCacheRead).toBe(0.3)
    expect(row.priceCacheWrite).toBe(1.5)
  })

  test('9 — pricing.json lacks the slug', () => {
    const declarations = [decl({ cursorName: 'Model A', cursorSlug: 'model-a' })]
    const catalogueRows = [
      catalogue({ name: 'Model A', input: 7, output: 8, cacheRead: 0.7, cacheWrite: 3.5 }),
    ]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: [],
      aaModels: [aaModel({ slug: 'fixture-aa' })],
    })

    const row = result.rows[0]!
    expect(row.priceInput).toBe(7)
    expect(row.priceOutput).toBe(8)
    expect(row.priceCacheRead).toBe(0.7)
    expect(row.priceCacheWrite).toBe(3.5)
  })

  test('10 — AA record with coding: null', () => {
    const declarations = [decl({ cursorName: 'Model A', cursorSlug: 'model-a' })]

    const result = joinModels({
      declarations,
      catalogue: [catalogue({ name: 'Model A' })],
      pricing: [pricing({ slug: 'model-a' })],
      aaModels: [aaModel({ slug: 'fixture-aa', coding: null })],
    })

    expect(result.rows[0]!.coding).toBeNull()
    expect(result.rows[0]!.coding).not.toBe(0)
  })

  test('11 — a Fast row and its base row keep their own published prices', () => {
    const declarations = [
      decl({ cursorName: 'Base Model', cursorSlug: 'base-model', aaSlug: 'shared-aa' }),
      decl({
        cursorName: 'Base Model (Fast)',
        cursorSlug: 'base-model-fast',
        aaSlug: 'shared-aa',
      }),
    ]
    const catalogueRows = [
      catalogue({ name: 'Base Model', input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 }),
      catalogue({
        name: 'Base Model (Fast)',
        input: 4,
        output: 15,
        cacheRead: 0.5,
        cacheWrite: 1.5,
      }),
    ]
    const pricingRows = [
      pricing({ slug: 'base-model', input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 }),
      pricing({ slug: 'base-model-fast', input: 4, output: 15, cacheRead: 0.5, cacheWrite: 1.5 }),
    ]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: pricingRows,
      aaModels: [aaModel({ slug: 'shared-aa' })],
    })

    const base = result.rows.find((r) => r.cursorSlug === 'base-model')!
    const fast = result.rows.find((r) => r.cursorSlug === 'base-model-fast')!
    expect(base.priceInput).toBe(1)
    expect(base.priceOutput).toBe(2)
    expect(fast.priceInput).toBe(4)
    expect(fast.priceOutput).toBe(15)
    expect(fast.priceInput).not.toBe(base.priceInput! * 3)
  })

  test('12 — Fast row and base row share the same aaSlug', () => {
    const declarations = [
      decl({ cursorName: 'Base Model', cursorSlug: 'base-model', aaSlug: 'shared-aa' }),
      decl({
        cursorName: 'Base Model (Fast)',
        cursorSlug: 'base-model-fast',
        aaSlug: 'shared-aa',
      }),
    ]

    const result = joinModels({
      declarations,
      catalogue: [catalogue({ name: 'Base Model' }), catalogue({ name: 'Base Model (Fast)' })],
      pricing: [pricing({ slug: 'base-model' }), pricing({ slug: 'base-model-fast' })],
      aaModels: [
        aaModel({
          slug: 'shared-aa',
          intelligence: 77,
          coding: 88,
          agentic: 66,
          costPerTask: 1.23,
        }),
      ],
    })

    const base = result.rows.find((r) => r.cursorSlug === 'base-model')!
    const fast = result.rows.find((r) => r.cursorSlug === 'base-model-fast')!
    expect(base.intelligence).toBe(77)
    expect(fast.intelligence).toBe(77)
    expect(base.coding).toBe(88)
    expect(fast.coding).toBe(88)
    expect(base.agentic).toBe(66)
    expect(fast.agentic).toBe(66)
    expect(base.aaCostPerTask).toBe(1.23)
    expect(fast.aaCostPerTask).toBe(1.23)
  })

  test('13 — aaVariantNote equals the declaration note', () => {
    const declarations = [
      decl({
        cursorName: 'Model A',
        cursorSlug: 'model-a',
        note: 'alias -> Claude 4 Sonnet (Reasoning)',
      }),
    ]

    const result = joinModels({
      declarations,
      catalogue: [catalogue({ name: 'Model A' })],
      pricing: [pricing({ slug: 'model-a' })],
      aaModels: [aaModel({ slug: 'fixture-aa' })],
    })

    expect(result.rows[0]!.aaVariantNote).toBe('alias -> Claude 4 Sonnet (Reasoning)')
  })

  test('14 — output row count equals the declarations passed in', () => {
    const declarations = [
      decl({ cursorName: 'Model A', cursorSlug: 'model-a' }),
      decl({ cursorName: 'Model B', cursorSlug: 'model-b', aaSlug: null }),
      decl({ cursorName: 'Model C', cursorSlug: 'model-c', aaSlug: 'aa-c' }),
    ]

    const result = joinModels({
      declarations,
      catalogue: [
        catalogue({ name: 'Model A' }),
        catalogue({ name: 'Model B' }),
        catalogue({ name: 'Model C' }),
      ],
      pricing: [
        pricing({ slug: 'model-a' }),
        pricing({ slug: 'model-b' }),
        pricing({ slug: 'model-c' }),
      ],
      aaModels: [aaModel({ slug: 'fixture-aa' }), aaModel({ slug: 'aa-c' })],
    })

    expect(result.rows).toHaveLength(3)
  })

  test('15 — pricing.json slug is cursor-composer-2-5, declaration cursorSlug is composer-2-5', () => {
    const declarations = [
      decl({
        cursorName: 'Composer 2.5',
        cursorSlug: 'composer-2-5',
        aaSlug: null,
      }),
    ]
    const catalogueRows = [
      catalogue({
        name: 'Composer 2.5',
        input: 99,
        output: 99,
        cacheRead: 99,
        cacheWrite: 99,
      }),
    ]
    const pricingRows = [
      pricing({
        slug: 'cursor-composer-2-5',
        input: 0.5,
        output: 2.5,
        cacheRead: 0.2,
        cacheWrite: null,
      }),
    ]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: pricingRows,
      aaModels: [],
    })

    const row = result.rows[0]!
    expect(row.priceInput).toBe(0.5)
    expect(row.priceOutput).toBe(2.5)
    expect(row.priceCacheRead).toBe(0.2)
    expect(row.priceCacheWrite).toBeNull()
  })

  test('16 — a declaration matching neither price source', () => {
    const declarations = [decl({ cursorName: 'No Prices', cursorSlug: 'no-prices' })]

    expectJoinError(
      () =>
        joinModels({
          declarations,
          catalogue: [
            catalogue({
              name: 'No Prices',
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
            }),
          ],
          pricing: [],
          aaModels: [aaModel({ slug: 'fixture-aa' })],
        }),
      /No Prices/,
    )
  })

  test('17 — AA record with costPerTask: null', () => {
    const declarations = [decl({ cursorName: 'Model A', cursorSlug: 'model-a' })]

    const result = joinModels({
      declarations,
      catalogue: [catalogue({ name: 'Model A' })],
      pricing: [pricing({ slug: 'model-a' })],
      aaModels: [aaModel({ slug: 'fixture-aa', costPerTask: null })],
    })

    expect(result.rows[0]!.aaCostPerTask).toBeNull()
    expect(result.rows[0]!.aaCostPerTask).not.toBe(0)
  })

  test('18 — provider and hidden come from the markdown row, not pricing.json', () => {
    const declarations = [decl({ cursorName: 'Model A', cursorSlug: 'model-a' })]
    const catalogueRows = [
      catalogue({ name: 'Model A', provider: 'Markdown Provider', hidden: true }),
    ]
    const pricingRows = [pricing({ slug: 'model-a', provider: 'Pricing Provider', hidden: false })]

    const result = joinModels({
      declarations,
      catalogue: catalogueRows,
      pricing: pricingRows,
      aaModels: [aaModel({ slug: 'fixture-aa' })],
    })

    const row = result.rows[0]!
    expect(row.provider).toBe('Markdown Provider')
    expect(row.hidden).toBe(true)
  })
})
