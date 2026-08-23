import type { Transport } from './transport'

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
export class CursorPricingError extends Error {}

const CURSOR_PRICING_URL = 'https://cursor.com/docs/models/pricing.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePriceField(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'number') {
    throw new CursorPricingError('invalid price field')
  }
  return value
}

function mapCursorPrice(record: unknown): CursorPrice {
  if (!isRecord(record)) {
    throw new CursorPricingError('invalid cursor pricing row')
  }

  const slug = record.slug
  const name = record.name
  const provider = record.provider
  const hidden = record.hidden

  if (typeof slug !== 'string' || typeof name !== 'string' || typeof provider !== 'string') {
    throw new CursorPricingError('invalid cursor pricing row fields')
  }

  if (typeof hidden !== 'boolean') {
    throw new CursorPricingError('invalid hidden field')
  }

  const pricing = record.pricing
  if (!isRecord(pricing)) {
    throw new CursorPricingError(`missing pricing for ${slug}`)
  }

  return {
    slug,
    name,
    provider,
    hidden,
    input: parsePriceField(pricing.input),
    output: parsePriceField(pricing.output),
    cacheRead: parsePriceField(pricing.cacheRead),
    cacheWrite: parsePriceField(pricing.cacheWrite),
  }
}

export async function fetchCursorPricingJson(
  transport: Transport,
  minExpectedRows = 8,
): Promise<readonly CursorPrice[]> {
  const response = await transport(CURSOR_PRICING_URL, {})

  if (response.status !== 200) {
    throw new CursorPricingError(`Cursor pricing fetch failed with HTTP ${response.status}`)
  }

  const body = await response.json()
  if (!isRecord(body)) {
    throw new CursorPricingError('invalid cursor pricing response')
  }

  const schemaVersion = body.schemaVersion
  if (schemaVersion !== 1) {
    throw new CursorPricingError(`unsupported schemaVersion ${String(schemaVersion)}`)
  }

  const models = body.models
  if (!Array.isArray(models)) {
    throw new CursorPricingError('invalid cursor pricing models array')
  }

  const rows = models.map(mapCursorPrice)

  if (rows.length < minExpectedRows) {
    throw new CursorPricingError(`row count ${rows.length} below floor ${minExpectedRows}`)
  }

  return rows
}
