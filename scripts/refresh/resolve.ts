import { autoResolveAaSlug } from './autoResolve'
import type { CursorModelDeclaration } from './declaration'
import type { AaModel } from './fetchArtificialAnalysis'
import { declarationFromOverride, type Overrides } from './overrides'
import type { CursorCatalogueRow } from './parseCursorMarkdown'
import { deriveCursorSlug } from './slug'

export type ResolveResult = {
  /** Exactly one declaration per catalogue row, in catalogue order. */
  readonly declarations: readonly CursorModelDeclaration[]
  /** Override keys naming a model Cursor does not publish. Reported, never fatal. */
  readonly unusedOverrides: readonly string[]
}

/** PURE. Builds the Cursor -> AA mapping for every model Cursor currently publishes.
 *
 *  Nothing here is hand-maintained. A model appearing or disappearing upstream needs no
 *  human action: the catalogue is the input, so the mapping simply follows it. `overrides`
 *  supplies the exceptions where the rule is known to be wrong. */
export function resolveDeclarations(
  overrides: Overrides,
  catalogue: readonly CursorCatalogueRow[],
  aaModels: readonly AaModel[],
): ResolveResult {
  const declarations = catalogue.map((row) => {
    const cursorSlug = deriveCursorSlug(row.name)
    const override = overrides.get(row.name)

    if (override) {
      return declarationFromOverride(row.name, cursorSlug, override)
    }

    const resolution = autoResolveAaSlug(cursorSlug, aaModels)

    if (resolution.kind === 'declined') {
      return {
        cursorName: row.name,
        cursorSlug,
        aaSlug: null,
        allowNonReasoning: false,
        note: resolution.reason,
        origin: 'auto',
      } satisfies CursorModelDeclaration
    }

    return {
      cursorName: row.name,
      cursorSlug,
      aaSlug: resolution.aaSlug,
      allowNonReasoning: false,
      note: resolution.note,
      origin: 'auto',
    } satisfies CursorModelDeclaration
  })

  const publishedNames = new Set(catalogue.map((row) => row.name))
  const unusedOverrides = [...overrides.keys()].filter((name) => !publishedNames.has(name))

  return { declarations, unusedOverrides }
}
