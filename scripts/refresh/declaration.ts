/** How one Cursor model maps to an Artificial Analysis record.
 *
 *  These are DERIVED per run by `resolve.ts`, not hand-maintained. `overrides.json` supplies
 *  the exceptions. */
export type CursorModelDeclaration = {
  /** Display name exactly as it appears in Cursor's models-and-pricing.md table. */
  readonly cursorName: string
  /** Dash-flattened cursorName. Join key on the Cursor side. */
  readonly cursorSlug: string
  /** AA `slug` this model maps to, or null when AA has no record for it. */
  readonly aaSlug: string | null
  /** Set true ONLY to accept an AA record whose name contains '(Non-reasoning'. */
  readonly allowNonReasoning: boolean
  /** Why this AA record was chosen. Human-readable provenance, carried onto the row. */
  readonly note: string
  /** Whether a human overrode the rule for this model. */
  readonly origin: 'override' | 'auto'
}
