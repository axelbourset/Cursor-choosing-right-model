import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { fixtureTransport } from './fixtureTransport'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readFixture = (relativePath: string) => readFile(path.join(repoRoot, relativePath), 'utf-8')

describe('fixtureTransport', () => {
  test('maps AA free-tier page 1', async () => {
    const transport = fixtureTransport(readFixture)
    const response = await transport(
      'https://artificialanalysis.ai/api/v2/language/models/free?page=1',
      { 'x-api-key': 'fixture' },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('pagination.page', 1)
  })

  test('maps AA free-tier page 2', async () => {
    const transport = fixtureTransport(readFixture)
    const response = await transport(
      'https://artificialanalysis.ai/api/v2/language/models/free?page=2',
      {},
    )

    const body = await response.json()
    expect(body).toHaveProperty('pagination.page', 2)
  })

  test('maps cursor pricing json', async () => {
    const transport = fixtureTransport(readFixture)
    const response = await transport('https://cursor.com/docs/models/pricing.json', {})

    const body = await response.json()
    expect(body).toHaveProperty('schemaVersion', 1)
  })

  test('maps cursor markdown', async () => {
    const transport = fixtureTransport(readFixture)
    const response = await transport('https://cursor.com/docs/models-and-pricing.md', {})

    const body = await response.text()
    expect(body).toContain('| Model')
  })
})
