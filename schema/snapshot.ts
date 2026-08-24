import { z } from 'zod'

/** null means "not measured". NEVER 0. See PRD C01, C08, C11. */
const nullableNumber = z.number().nullable()

export const modelRowSchema = z.object({
  cursorName: z.string().min(1),
  cursorSlug: z.string().min(1),
  provider: z.string().min(1),
  hidden: z.boolean(),
  aaSlug: z.string().nullable(),
  aaName: z.string().nullable(),
  /** Which AA record this row resolved to, and why. Provenance for ADR-9. */
  aaVariantNote: z.string().nullable(),
  intelligence: nullableNumber,
  coding: nullableNumber,
  agentic: nullableNumber,
  aaCostPerTask: nullableNumber,
  priceInput: nullableNumber,
  priceOutput: nullableNumber,
  priceCacheRead: nullableNumber,
  priceCacheWrite: nullableNumber,
})

export const coverageSchema = z.object({
  totalRows: z.number().int(),
  resolved: z.number().int(),
  intelligence: z.number().int(),
  coding: z.number().int(),
  agentic: z.number().int(),
  aaCostPerTask: z.number().int(),
})

export const unmatchedEntrySchema = z.object({
  cursorName: z.string(),
  reason: z.string(),
})
export type UnmatchedEntry = z.infer<typeof unmatchedEntrySchema>

export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  source: z.object({
    aaIndexVersion: z.number(),
    attribution: z.literal('Artificial Analysis (artificialanalysis.ai)'),
  }),
  coverage: coverageSchema,
  unmatched: z.array(unmatchedEntrySchema),
  models: z.array(modelRowSchema),
})

export type ModelRow = z.infer<typeof modelRowSchema>
export type Coverage = z.infer<typeof coverageSchema>
export type Snapshot = z.infer<typeof snapshotSchema>

/** Metric keys that can be charted. Used by domain/ and src/. */
export const METRIC_KEYS = ['intelligence', 'coding', 'agentic'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

/** Cost axis keys for the scatter chart X axis. */
export const COST_AXIS_KEYS = ['input', 'output', 'cacheRead'] as const
export type CostAxisKey = (typeof COST_AXIS_KEYS)[number]

export const CURRENT_SCHEMA_VERSION = 1

/** The dev-server URL for the local snapshot. Lives here so `vite.plugins.ts` and
 *  `useSnapshot.ts` cannot drift — a renamed literal would 404 and silently show the
 *  drop zone, which is a designed state, hiding the bug. */
export const SNAPSHOT_DEV_URL = '/__snapshot'
