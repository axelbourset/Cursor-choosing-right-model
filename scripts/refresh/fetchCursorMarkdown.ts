import type { Transport } from './transport'

export class CursorMarkdownFetchError extends Error {}

export const CURSOR_MARKDOWN_URL = 'https://cursor.com/docs/models-and-pricing.md'

export async function fetchCursorMarkdown(
  transport: Transport,
  minBytes = 10_000,
): Promise<string> {
  const response = await transport(CURSOR_MARKDOWN_URL, {})

  if (response.status !== 200) {
    throw new CursorMarkdownFetchError(`Cursor markdown fetch failed with HTTP ${response.status}`)
  }

  const body = await response.text()

  if (body.length < minBytes) {
    throw new CursorMarkdownFetchError(`body length ${body.length} below floor ${minBytes}`)
  }

  return body
}
