import { z } from 'zod'
import type { Transport } from './transport'

export class CursorPricingError extends Error {
  override name = 'CursorPricingError'
}

const CURSOR_PRICING_URL = 'https://cursor.com/docs/models/pricing.json'

/** A price is absent, not zero, when the field is missing. `.nullish()` collapses both
 *  `null` and `undefined` to the same "not published" state the schema models. */
const price = z
  .number()
  .nullish()
  .transform((value) => value ?? null)

const pricingRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  hidden: z.boolean(),
  pricing: z.object({
    input: price,
    output: price,
    cacheRead: price,
    cacheWrite: price,
  }),
})

const PRICING_SCHEMA_VERSION = 1

const pricingResponseSchema = z.object({
  schemaVersion: z.number(),
  models: z.array(pricingRowSchema),
})

export type CursorPrice = {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly hidden: boolean
  readonly input: number | null
  readonly output: number | null
  readonly cacheRead: number | null
  readonly cacheWrite: number | null
}

/** Parses at the boundary rather than hand-checking field by field: zod names the failing
 *  path, so a malformed upstream row says which row and which field. */
export async function fetchCursorPricingJson(
  transport: Transport,
  minExpectedRows = 8,
): Promise<readonly CursorPrice[]> {
  const response = await transport(CURSOR_PRICING_URL, {})

  if (response.status !== 200) {
    throw new CursorPricingError(`Cursor pricing fetch failed with HTTP ${response.status}`)
  }

  const parsed = pricingResponseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new CursorPricingError(`invalid cursor pricing response: ${parsed.error.message}`)
  }

  // Checked separately from the schema so the message can name the version actually served.
  if (parsed.data.schemaVersion !== PRICING_SCHEMA_VERSION) {
    throw new CursorPricingError(`unsupported schemaVersion ${String(parsed.data.schemaVersion)}`)
  }

  const rows: readonly CursorPrice[] = parsed.data.models.map((model) => ({
    slug: model.slug,
    name: model.name,
    provider: model.provider,
    hidden: model.hidden,
    input: model.pricing.input,
    output: model.pricing.output,
    cacheRead: model.pricing.cacheRead,
    cacheWrite: model.pricing.cacheWrite,
  }))

  if (rows.length < minExpectedRows) {
    throw new CursorPricingError(`row count ${rows.length} below floor ${minExpectedRows}`)
  }

  return rows
}
