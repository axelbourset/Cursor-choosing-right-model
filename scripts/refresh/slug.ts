/** PURE. The dash-flattening rule that turns a Cursor display name into its join key.
 *
 *  This rule was previously documented only as a comment on `CursorModelDeclaration.cursorSlug`
 *  and applied by hand to a checked-in table. That table is gone; `resolve.test.ts` tests 2-7
 *  pin the mappings it used to hold, as assertions about the rule that now derives them. */
export function deriveCursorSlug(cursorName: string): string {
  return cursorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
