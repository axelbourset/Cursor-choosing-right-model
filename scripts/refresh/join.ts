import type { ModelRow, UnmatchedEntry } from '@schema/snapshot'
import type { CursorModelDeclaration } from './declaration'
import type { AaModel } from './fetchArtificialAnalysis'
import type { CursorPrice } from './fetchCursorPricingJson'
import type { CursorCatalogueRow } from './parseCursorMarkdown'

export type JoinResult = {
  readonly rows: readonly ModelRow[]
  /** Rows with no AA record. These ALSO appear in `rows` with null AA fields. */
  readonly unresolved: readonly UnmatchedEntry[]
}
export class JoinError extends Error {
  override name = 'JoinError'
}

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

/** One object, not four interchangeable `number | null` positionals: the call site passed
 *  them in a different order than `CursorCatalogueRow` declares them, and any transposition
 *  would have typechecked. */
function hasAnyPrice(
  prices: Pick<CursorCatalogueRow, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>,
): boolean {
  return (
    prices.input !== null ||
    prices.output !== null ||
    prices.cacheRead !== null ||
    prices.cacheWrite !== null
  )
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

  if (!hasAnyPrice(catalogueRow)) {
    throw new JoinError(`no price source for ${declaration.cursorName}`)
  }

  return {
    priceInput: catalogueRow.input,
    priceOutput: catalogueRow.output,
    priceCacheRead: catalogueRow.cacheRead,
    priceCacheWrite: catalogueRow.cacheWrite,
  }
}

/** Last-write-wins would silently pick one of two records for the same slug, so a duplicate
 *  is treated like every other broken invariant in this file: it throws. */
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

/** Declarations are INJECTED, not imported — the CLI passes the set `resolve.ts` derived
 *  from the live catalogue.
 *
 *  Every guard below still throws, and all of them now describe OUR data being wrong rather
 *  than upstream having moved: `resolve.ts` produces exactly one declaration per catalogue
 *  row, so a membership failure here is an internal invariant violation, and a stale alias
 *  can only come from a hand-written override naming a slug AA no longer publishes. */
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
      unresolved.push({ cursorName: declaration.cursorName, reason: declaration.note })
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
