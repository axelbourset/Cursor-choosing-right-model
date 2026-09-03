import { z } from 'zod'
import type { Transport } from './transport'

export type AaModel = {
  readonly slug: string
  readonly name: string
  readonly intelligence: number | null
  readonly coding: number | null
  readonly agentic: number | null
  readonly costPerTask: number | null
}

export type AaFetchResult = {
  readonly models: readonly AaModel[]
  readonly indexVersion: number
  readonly rateLimitRemaining: string | null
}

export class AaFetchError extends Error {
  override name = 'AaFetchError'
}

const AA_FREE_MODELS_URL = 'https://artificialanalysis.ai/api/v2/language/models/free'

/** A hard stop independent of the upstream `total_pages`, so a response claiming a billion
 *  pages cannot make this loop forever. */
const MAX_PAGES = 50

/** A score is absent, never zero. The keys must be PRESENT — a missing evaluation block is
 *  a schema change worth failing on, whereas a null value is normal for an unbenchmarked
 *  dimension. */
const evaluationScore = z.number().nullable()

const aaRecordSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  evaluations: z.object({
    artificial_analysis_intelligence_index: evaluationScore,
    artificial_analysis_coding_index: evaluationScore,
    artificial_analysis_agentic_index: evaluationScore,
  }),
  artificial_analysis_intelligence_index_cost: z
    .object({ cost_per_task: z.object({ total_cost: z.number().nullish() }).nullish() })
    .nullish(),
})

const aaEnvelopeSchema = z.object({
  intelligence_index_version: z.number(),
  pagination: z.object({
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    has_more: z.boolean(),
  }),
  data: z.array(aaRecordSchema),
})

function toAaModel(record: z.infer<typeof aaRecordSchema>): AaModel {
  return {
    slug: record.slug,
    name: record.name,
    intelligence: record.evaluations.artificial_analysis_intelligence_index,
    coding: record.evaluations.artificial_analysis_coding_index,
    agentic: record.evaluations.artificial_analysis_agentic_index,
    costPerTask:
      record.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost ?? null,
  }
}

export async function fetchArtificialAnalysis(
  apiKey: string,
  transport: Transport,
  minExpectedModels = 100,
): Promise<AaFetchResult> {
  const headers = { 'x-api-key': apiKey }
  const models: AaModel[] = []
  let indexVersion: number
  let rateLimitRemaining: string | null
  let page = 1

  for (;;) {
    const response = await transport(`${AA_FREE_MODELS_URL}?page=${String(page)}`, headers)

    if (response.status !== 200) {
      const detail = await response.text().catch(() => '')
      const suffix = detail === '' ? '' : `: ${detail.slice(0, 200)}`
      if (response.status === 429) {
        throw new AaFetchError(`rate limit: HTTP ${String(response.status)}${suffix}`)
      }
      throw new AaFetchError(`AA fetch failed with HTTP ${String(response.status)}${suffix}`)
    }

    const parsed = aaEnvelopeSchema.safeParse(await response.json())
    if (!parsed.success) {
      throw new AaFetchError(`invalid AA response on page ${String(page)}: ${parsed.error.message}`)
    }

    const envelope = parsed.data
    indexVersion = envelope.intelligence_index_version
    models.push(...envelope.data.map(toAaModel))

    const { total_pages: totalPages, has_more: hasMore } = envelope.pagination

    if (page >= totalPages && hasMore) {
      throw new AaFetchError('has_more true past total_pages')
    }

    if (!hasMore) {
      rateLimitRemaining = response.headers['x-ratelimit-remaining'] ?? null
      break
    }

    page += 1

    if (page > MAX_PAGES) {
      throw new AaFetchError(`pagination exceeded ${String(MAX_PAGES)} pages`)
    }
  }

  if (models.length < minExpectedModels) {
    throw new AaFetchError(
      `model count ${String(models.length)} below floor ${String(minExpectedModels)}`,
    )
  }

  return { models, indexVersion, rateLimitRemaining }
}
