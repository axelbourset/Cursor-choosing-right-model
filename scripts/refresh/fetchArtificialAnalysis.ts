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

export class AaFetchError extends Error {}

const AA_FREE_MODELS_URL = 'https://artificialanalysis.ai/api/v2/language/models/free'

const EVALUATION_KEYS = [
  'artificial_analysis_intelligence_index',
  'artificial_analysis_coding_index',
  'artificial_analysis_agentic_index',
] as const

type AaPagination = {
  readonly page: number
  readonly page_size: number
  readonly total_pages: number
  readonly has_more: boolean
}

type AaEnvelope = {
  readonly intelligence_index_version: number
  readonly pagination: AaPagination
  readonly data: readonly unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEnvelope(body: unknown): AaEnvelope {
  if (!isRecord(body)) {
    throw new AaFetchError('invalid AA response envelope')
  }

  const pagination = body.pagination
  if (!isRecord(pagination)) {
    throw new AaFetchError('invalid AA pagination')
  }

  const data = body.data
  if (!Array.isArray(data)) {
    throw new AaFetchError('invalid AA data array')
  }

  const indexVersion = body.intelligence_index_version
  if (typeof indexVersion !== 'number') {
    throw new AaFetchError('invalid intelligence_index_version')
  }

  const page = pagination.page
  const page_size = pagination.page_size
  const total_pages = pagination.total_pages
  const has_more = pagination.has_more

  if (
    typeof page !== 'number' ||
    typeof page_size !== 'number' ||
    typeof total_pages !== 'number' ||
    typeof has_more !== 'boolean'
  ) {
    throw new AaFetchError('invalid AA pagination fields')
  }

  return {
    intelligence_index_version: indexVersion,
    pagination: { page, page_size, total_pages, has_more },
    data,
  }
}

function mapAaModel(record: unknown): AaModel {
  if (!isRecord(record)) {
    throw new AaFetchError('invalid AA model record')
  }

  const slug = record.slug
  const name = record.name
  if (typeof slug !== 'string' || typeof name !== 'string') {
    throw new AaFetchError('invalid AA model slug or name')
  }

  const evaluations = record.evaluations
  if (!isRecord(evaluations)) {
    throw new AaFetchError(`missing evaluations for ${slug}`)
  }

  for (const key of EVALUATION_KEYS) {
    if (!(key in evaluations)) {
      throw new AaFetchError(`missing evaluation key ${key} for ${slug}`)
    }
  }

  const intelligence = evaluations.artificial_analysis_intelligence_index
  const coding = evaluations.artificial_analysis_coding_index
  const agentic = evaluations.artificial_analysis_agentic_index

  if (
    (intelligence !== null && typeof intelligence !== 'number') ||
    (coding !== null && typeof coding !== 'number') ||
    (agentic !== null && typeof agentic !== 'number')
  ) {
    throw new AaFetchError(`invalid evaluation values for ${slug}`)
  }

  const costRoot = record.artificial_analysis_intelligence_index_cost
  let costPerTask: number | null = null
  if (costRoot !== null && costRoot !== undefined) {
    if (!isRecord(costRoot)) {
      throw new AaFetchError(`invalid cost object for ${slug}`)
    }
    const costPerTaskRoot = costRoot.cost_per_task
    if (costPerTaskRoot !== null && costPerTaskRoot !== undefined) {
      if (!isRecord(costPerTaskRoot)) {
        throw new AaFetchError(`invalid cost_per_task for ${slug}`)
      }
      const totalCost = costPerTaskRoot.total_cost
      if (totalCost !== null && totalCost !== undefined) {
        if (typeof totalCost !== 'number') {
          throw new AaFetchError(`invalid total_cost for ${slug}`)
        }
        costPerTask = totalCost
      }
    }
  }

  return {
    slug,
    name,
    intelligence,
    coding,
    agentic,
    costPerTask,
  }
}

export async function fetchArtificialAnalysis(
  apiKey: string,
  transport: Transport,
  minExpectedModels = 100,
): Promise<AaFetchResult> {
  const headers = { 'x-api-key': apiKey }
  const models: AaModel[] = []
  let indexVersion!: number
  let rateLimitRemaining!: string | null
  let page = 1

  while (true) {
    const url = `${AA_FREE_MODELS_URL}?page=${page}`
    const response = await transport(url, headers)

    if (response.status !== 200) {
      if (response.status === 429) {
        throw new AaFetchError(`rate limit: HTTP ${response.status}`)
      }
      throw new AaFetchError(`AA fetch failed with HTTP ${response.status}`)
    }

    const envelope = parseEnvelope(await response.json())
    indexVersion = envelope.intelligence_index_version

    for (const record of envelope.data) {
      models.push(mapAaModel(record))
    }

    const { total_pages, has_more } = envelope.pagination

    if (page >= total_pages && has_more) {
      throw new AaFetchError('has_more true past total_pages')
    }

    if (!has_more) {
      rateLimitRemaining = response.headers['x-ratelimit-remaining'] ?? null
      break
    }

    page += 1
  }

  if (models.length < minExpectedModels) {
    throw new AaFetchError(`model count ${models.length} below floor ${minExpectedModels}`)
  }

  return {
    models,
    indexVersion,
    rateLimitRemaining,
  }
}
