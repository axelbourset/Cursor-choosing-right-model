import type { Transport } from './transport'

const NO_HEADERS: Readonly<Record<string, string>> = {}

function aaFixturePath(url: string): string {
  const match = /[?&]page=(\d+)/.exec(url)
  const page = match?.[1] ?? '1'
  return `fixtures/aa-free-page-${page}.synthetic.json`
}

/** Maps live request URLs to checked-in fixture files for offline pipeline runs. */
export function fixtureTransport(read: (p: string) => Promise<string>): Transport {
  return async (url) => {
    if (url.includes('/language/models/free')) {
      const body = await read(aaFixturePath(url))
      return {
        status: 200,
        headers: { 'x-ratelimit-remaining': '24' },
        json: () => Promise.resolve(JSON.parse(body) as unknown),
        text: () => Promise.resolve(body),
      }
    }

    if (url.includes('/docs/models/pricing.json')) {
      const body = await read('fixtures/cursor-pricing.json')
      return {
        status: 200,
        headers: NO_HEADERS,
        json: () => Promise.resolve(JSON.parse(body) as unknown),
        text: () => Promise.resolve(body),
      }
    }

    if (url.includes('/docs/models-and-pricing.md')) {
      const body = await read('fixtures/cursor-models.fixture.md')
      return {
        status: 200,
        headers: NO_HEADERS,
        json: () => Promise.reject(new Error('cursor markdown is not JSON')),
        text: () => Promise.resolve(body),
      }
    }

    throw new Error(`fixtureTransport: unmapped URL ${url}`)
  }
}
