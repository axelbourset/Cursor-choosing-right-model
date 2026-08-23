import type { ModelRow, UnmatchedEntry } from '@schema/snapshot'
import type { CursorModelDeclaration } from './aliases'
import type { AaModel } from './fetchArtificialAnalysis'
import type { CursorPrice } from './fetchCursorPricingJson'
import type { CursorCatalogueRow } from './parseCursorMarkdown'

export type JoinResult = {
  readonly rows: readonly ModelRow[]
  /** Rows with no AA record. These ALSO appear in `rows` with null AA fields. */
  readonly unresolved: readonly UnmatchedEntry[]
}
export class JoinError extends Error {}

export type JoinInput = {
  readonly declarations: readonly CursorModelDeclaration[]
  readonly catalogue: readonly CursorCatalogueRow[]
  readonly pricing: readonly CursorPrice[]
  readonly aaModels: readonly AaModel[]
}

function findPricingRow(
  pricing: readonly CursorPrice[],
  cursorSlug: string,
): CursorPrice | undefined {
  return pricing.find((row) => row.slug === cursorSlug || row.slug === `cursor-${cursorSlug}`)
}

function hasAnyPrice(
  input: number | null,
  output: number | null,
  cacheRead: number | null,
  cacheWrite: number | null,
): boolean {
  return input !== null || output !== null || cacheRead !== null || cacheWrite !== null
}

function resolvePrices(
  declaration: CursorModelDeclaration,
  catalogueRow: CursorCatalogueRow,
  pricing: readonly CursorPrice[],
): Pick<ModelRow, 'priceInput' | 'priceOutput' | 'priceCacheRead' | 'priceCacheWrite'> {
  const pricingRow = findPricingRow(pricing, declaration.cursorSlug)
  if (pricingRow) {
    return {
      priceInput: pricingRow.input,
      priceOutput: pricingRow.output,
      priceCacheRead: pricingRow.cacheRead,
      priceCacheWrite: pricingRow.cacheWrite,
    }
  }

  if (
    !hasAnyPrice(
      catalogueRow.input,
      catalogueRow.output,
      catalogueRow.cacheRead,
      catalogueRow.cacheWrite,
    )
  ) {
    throw new JoinError(`no price source for ${declaration.cursorName}`)
  }

  return {
    priceInput: catalogueRow.input,
    priceOutput: catalogueRow.output,
    priceCacheRead: catalogueRow.cacheRead,
    priceCacheWrite: catalogueRow.cacheWrite,
  }
}

function buildAaIndex(aaModels: readonly AaModel[]): Map<string, AaModel> {
  const index = new Map<string, AaModel>()
  for (const model of aaModels) {
    index.set(model.slug, model)
  }
  return index
}

function buildCatalogueIndex(
  catalogue: readonly CursorCatalogueRow[],
): Map<string, CursorCatalogueRow> {
  const index = new Map<string, CursorCatalogueRow>()
  for (const row of catalogue) {
    index.set(row.name, row)
  }
  return index
}

/** Declarations are INJECTED, not imported. T17's tests use small hand-made sets;
 *  only the CLI passes the real 47. Importing DECLARATIONS statically would make
 *  test case 14 impossible without module mocking. */
export function joinModels(input: JoinInput): JoinResult {
  const { declarations, catalogue, pricing, aaModels } = input
  const declarationNames = new Set(declarations.map((d) => d.cursorName))
  const catalogueByName = buildCatalogueIndex(catalogue)
  const aaBySlug = buildAaIndex(aaModels)

  for (const row of catalogue) {
    if (!declarationNames.has(row.name)) {
      throw new JoinError(`catalogue row not in declarations: ${row.name}`)
    }
  }

  const rows: ModelRow[] = []
  const unresolved: UnmatchedEntry[] = []

  for (const declaration of declarations) {
    const catalogueRow = catalogueByName.get(declaration.cursorName)
    if (!catalogueRow) {
      throw new JoinError(`missing catalogue row for ${declaration.cursorName}`)
    }

    const prices = resolvePrices(declaration, catalogueRow, pricing)

    if (declaration.aaSlug === null) {
      rows.push({
        cursorName: declaration.cursorName,
        cursorSlug: declaration.cursorSlug,
        provider: catalogueRow.provider,
        hidden: catalogueRow.hidden,
        aaSlug: null,
        aaName: null,
        aaVariantNote: declaration.note,
        intelligence: null,
        coding: null,
        agentic: null,
        aaCostPerTask: null,
        ...prices,
      })
      unresolved.push({
        cursorName: declaration.cursorName,
        reason: 'no AA benchmark data for this model',
      })
      continue
    }

    const aaRecord = aaBySlug.get(declaration.aaSlug)
    if (!aaRecord) {
      throw new JoinError(`stale alias for ${declaration.cursorName}: ${declaration.aaSlug}`)
    }

    if (aaRecord.name.includes('(Non-reasoning') && !declaration.allowNonReasoning) {
      throw new JoinError(`non-reasoning AA record for ${declaration.cursorName}: ${aaRecord.name}`)
    }

    rows.push({
      cursorName: declaration.cursorName,
      cursorSlug: declaration.cursorSlug,
      provider: catalogueRow.provider,
      hidden: catalogueRow.hidden,
      aaSlug: aaRecord.slug,
      aaName: aaRecord.name,
      aaVariantNote: declaration.note,
      intelligence: aaRecord.intelligence,
      coding: aaRecord.coding,
      agentic: aaRecord.agentic,
      aaCostPerTask: aaRecord.costPerTask,
      ...prices,
    })
  }

  return { rows, unresolved }
}
