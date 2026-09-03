import { z } from 'zod'

/** null means "not measured". NEVER 0. See PRD C01, C08, C11. */
const nullableNumber = z.number().nullable()

/** Bumping this rejects every older snapshot. Referenced by `snapshotSchema` and by the
 *  loader's staleness check, so the writer and reader cannot disagree. */
export const CURRENT_SCHEMA_VERSION = 1

/** One Cursor model joined to its Artificial Analysis record. The unit the whole app
 *  renders; every nullable field means "not measured", never zero. */
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

/** Dataset-level counts, derived from the rows rather than asserted. Lets the UI say
 *  "43 of 49" without every consumer recounting. */
const count = z.number().int().nonnegative()

export const coverageSchema = z.object({
  totalRows: count,
  resolved: count,
  intelligence: count,
  coding: count,
  agentic: count,
  aaCostPerTask: count,
})

/** A model Cursor publishes that has no Artificial Analysis record, with the reason.
 *  Operator-facing: it explains a gap rather than hiding it. */
export const unmatchedEntrySchema = z.object({
  cursorName: z.string(),
  reason: z.string(),
})
export type UnmatchedEntry = z.infer<typeof unmatchedEntrySchema>

/** The complete on-disk artifact `scripts/refresh` writes and the site loads. This is the
 *  contract between the two halves of the project: everything else is written against it. */
export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    generatedAt: z.iso.datetime(),
    source: z.object({
      aaIndexVersion: z.number(),
      attribution: z.literal('Artificial Analysis (artificialanalysis.ai)'),
    }),
    coverage: coverageSchema,
    unmatched: z.array(unmatchedEntrySchema),
    models: z.array(modelRowSchema),
  })
  // Coverage is derived from models, so a snapshot claiming counts the rows cannot support
  // is malformed. Enforced here, so both the writer and the browser loader get it free.
  .refine((snapshot) => snapshot.coverage.totalRows === snapshot.models.length, {
    message: 'coverage.totalRows must equal models.length',
    path: ['coverage', 'totalRows'],
  })
  .refine(
    (snapshot) =>
      (['resolved', 'intelligence', 'coding', 'agentic', 'aaCostPerTask'] as const).every(
        (key) => snapshot.coverage[key] <= snapshot.coverage.totalRows,
      ),
    { message: 'each coverage count must be <= totalRows', path: ['coverage'] },
  )

/** One row of the table and one point on the charts. */
export type ModelRow = z.infer<typeof modelRowSchema>
/** Dataset-level counts for the coverage note. */
export type Coverage = z.infer<typeof coverageSchema>
/** The validated snapshot document. */
export type Snapshot = z.infer<typeof snapshotSchema>

/** Metric keys that can be charted. Used by domain/ and src/. */
export const METRIC_KEYS = ['intelligence', 'coding', 'agentic'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

/** Cost axis keys for the scatter chart X axis. */
export const COST_AXIS_KEYS = ['input', 'output', 'cacheRead'] as const
export type CostAxisKey = (typeof COST_AXIS_KEYS)[number]

/** The dev-server URL for the local snapshot. Lives here so `vite.plugins.ts` and
 *  `useSnapshot.ts` cannot drift — a renamed literal would 404 and silently show the
 *  drop zone, which is a designed state, hiding the bug. */
export const SNAPSHOT_DEV_URL = '/__snapshot'

/** Where the refresh writes the snapshot and the dev server reads it, relative to the repo
 *  root. Shared for the same reason as `SNAPSHOT_DEV_URL`: two copies silently 404. */
export const SNAPSHOT_PATH = 'data/models.json'

/** The placeholder in `.env.example`. The CLI rejects it and `guard-no-data` allows it, so
 *  both must agree on the exact string. */
export const API_KEY_PLACEHOLDER = 'paste_your_key_here'
