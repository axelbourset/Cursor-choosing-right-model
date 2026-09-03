import { z } from 'zod'
import type { CursorModelDeclaration } from './declaration'

export class OverridesError extends Error {
  override name = 'OverridesError'
}

/** Strict: an unknown key is a typo, and a silently-ignored typo is exactly the failure
 *  ADR-4 wanted the compiler to prevent when this data lived in TypeScript. */
const overrideSchema = z
  .object({
    aaSlug: z.string().min(1).nullable(),
    reason: z.string().min(1),
    allowNonReasoning: z.boolean().optional(),
  })
  .strict()

/** `//` and `//example` are documentation for whoever opens the file. They are ignored —
 *  `//example` deliberately holds real, copy-pasteable entries that are NOT applied.
 *
 *  Strict at this level too: a typo'd `overides` key would otherwise parse clean and
 *  silently drop every override in the file. */
const overridesFileSchema = z
  .object({
    '//': z.unknown().optional(),
    '//example': z.unknown().optional(),
    overrides: z.record(z.string().min(1), overrideSchema),
  })
  .strict()

export type ModelOverride = z.infer<typeof overrideSchema>
/** A Map, not a Record: model names come from Cursor's published markdown, and a plain
 *  object would report inherited keys such as `constructor` as present overrides. */
export type Overrides = ReadonlyMap<string, ModelOverride>

export const OVERRIDES_PATH = 'scripts/refresh/overrides.json'

/** PURE. Validates the overrides document and returns its map.
 *
 *  This is the boundary zod exists for: the file is hand-edited data, so a malformed entry
 *  must fail here with a precise message rather than becoming a wrong mapping downstream. */
export function parseOverrides(raw: unknown): Overrides {
  const parsed = overridesFileSchema.safeParse(raw)
  if (!parsed.success) {
    throw new OverridesError(`${OVERRIDES_PATH} is invalid: ${parsed.error.message}`)
  }
  return new Map(Object.entries(parsed.data.overrides))
}

export function declarationFromOverride(
  cursorName: string,
  cursorSlug: string,
  override: ModelOverride,
): CursorModelDeclaration {
  return {
    cursorName,
    cursorSlug,
    aaSlug: override.aaSlug,
    allowNonReasoning: override.allowNonReasoning ?? false,
    note: `override: ${override.reason}`,
    origin: 'override',
  }
}
