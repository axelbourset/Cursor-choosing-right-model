export type HttpResponse = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly json: () => Promise<unknown>
  /** REQUIRED for the Cursor markdown, which is text/markdown not JSON. */
  readonly text: () => Promise<string>
}

/** Injected so tests never hit the network.
 *
 *  `signal` is optional so the fixture transport and the test doubles can ignore it; the
 *  real HTTP transport applies a timeout whether or not one is passed. */
export type Transport = (
  url: string,
  headers: Readonly<Record<string, string>>,
  signal?: AbortSignal,
) => Promise<HttpResponse>
