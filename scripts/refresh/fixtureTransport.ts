import type { Transport } from './transport'

function aaFixturePath(url: string): string {
  const match = url.match(/[?&]page=(\d+)/)
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
        json: async () => JSON.parse(body),
        text: async () => body,
      }
    }

    if (url.includes('/docs/models/pricing.json')) {
      const body = await read('fixtures/cursor-pricing.json')
      return {
        status: 200,
        headers: {} as Readonly<Record<string, string>>,
        json: async () => JSON.parse(body),
        text: async () => body,
      }
    }

    if (url.includes('/docs/models-and-pricing.md')) {
      const body = await read('fixtures/cursor-models.fixture.md')
      return {
        status: 200,
        headers: {} as Readonly<Record<string, string>>,
        json: async () => {
          throw new Error('cursor markdown is not JSON')
        },
        text: async () => body,
      }
    }

    throw new Error(`fixtureTransport: unmapped URL ${url}`)
  }
}
