import type { Transport } from './transport'

export class CursorMarkdownFetchError extends Error {
  override name = 'CursorMarkdownFetchError'
}

export const CURSOR_MARKDOWN_URL = 'https://cursor.com/docs/models-and-pricing.md'

export async function fetchCursorMarkdown(
  transport: Transport,
  minLength = 10_000,
): Promise<string> {
  const response = await transport(CURSOR_MARKDOWN_URL, {})

  if (response.status !== 200) {
    throw new CursorMarkdownFetchError(`Cursor markdown fetch failed with HTTP ${response.status}`)
  }

  const body = await response.text()

  if (body.length < minLength) {
    throw new CursorMarkdownFetchError(`body length ${body.length} below floor ${minLength}`)
  }

  return body
}
