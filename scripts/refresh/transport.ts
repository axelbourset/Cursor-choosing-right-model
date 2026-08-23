export type HttpResponse = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly json: () => Promise<unknown>
  /** REQUIRED for the Cursor markdown, which is text/markdown not JSON. */
  readonly text: () => Promise<string>
}

/** Injected so tests never hit the network. */
export type Transport = (
  url: string,
  headers: Readonly<Record<string, string>>,
) => Promise<HttpResponse>
