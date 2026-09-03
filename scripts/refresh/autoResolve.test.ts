import { describe, expect, test } from 'vitest'
import { autoResolveAaSlug } from './autoResolve'
import type { AaModel } from './fetchArtificialAnalysis'

function aa(overrides: Partial<AaModel> & Pick<AaModel, 'slug'>): AaModel {
  return {
    name: overrides.slug,
    intelligence: 50,
    coding: 40,
    agentic: 30,
    costPerTask: 1,
    ...overrides,
  }
}

describe('autoResolveAaSlug', () => {
  test('1 — an exact slug match resolves', () => {
    const result = autoResolveAaSlug('claude-opus-5', [
      aa({ slug: 'claude-opus-5', name: 'Claude Opus 5 (Max Effort)' }),
    ])

    expect(result).toEqual({
      kind: 'resolved',
      aaSlug: 'claude-opus-5',
      aaName: 'Claude Opus 5 (Max Effort)',
      note: expect.stringContaining('UNREVIEWED'),
    })
  })

  test('2 — a closed-set effort suffix resolves', () => {
    const result = autoResolveAaSlug('gemini-3-flash', [
      aa({ slug: 'gemini-3-flash-reasoning', name: 'Gemini 3 Flash Preview (Reasoning)' }),
    ])

    expect(result).toMatchObject({ kind: 'resolved', aaSlug: 'gemini-3-flash-reasoning' })
  })

  test('3 — the highest-scoring family member wins (ADR-9)', () => {
    const result = autoResolveAaSlug('gpt-5-mini', [
      aa({ slug: 'gpt-5-mini', name: 'GPT-5 mini (high)', intelligence: 25.8 }),
      aa({ slug: 'gpt-5-mini-medium', name: 'GPT-5 mini (medium)', intelligence: 31.6 }),
    ])

    expect(result).toMatchObject({ kind: 'resolved', aaSlug: 'gpt-5-mini-medium' })
  })

  test('4 — a (Non-reasoning record is excluded even on an exact slug hit', () => {
    const result = autoResolveAaSlug('claude-sonnet-4-6', [
      aa({
        slug: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6 (Non-reasoning)',
        intelligence: 36.8,
      }),
      aa({
        slug: 'claude-sonnet-4-6-adaptive',
        name: 'Claude Sonnet 4.6 (Adaptive)',
        intelligence: 48.4,
      }),
    ])

    expect(result).toMatchObject({ kind: 'resolved', aaSlug: 'claude-sonnet-4-6-adaptive' })
  })

  test('5 — a family of only (Non-reasoning records declines', () => {
    const result = autoResolveAaSlug('glm-4-5v', [
      aa({ slug: 'glm-4-5v', name: 'GLM-4.5V (Non-reasoning)' }),
    ])

    expect(result).toMatchObject({
      kind: 'declined',
      reason: expect.stringContaining('Non-reasoning'),
    })
  })

  test('6 — a bare prefix is NOT a family member: GPT-5 does not take gpt-5-6-sol', () => {
    // The documented trap: `gpt-5-` is a prefix of `gpt-5-6-sol` (60.9), which would show a
    // legacy model with frontier scores. `6-sol` is not in the closed suffix set.
    const result = autoResolveAaSlug('gpt-5', [
      aa({ slug: 'gpt-5', name: 'GPT-5 (high)', intelligence: 35.3 }),
      aa({ slug: 'gpt-5-6-sol', name: 'GPT-5.6 Sol (max)', intelligence: 60.9 }),
    ])

    expect(result).toMatchObject({ kind: 'resolved', aaSlug: 'gpt-5' })
  })

  test('7 — a bare prefix is NOT a family member: claude-sonnet-4 takes nothing', () => {
    const result = autoResolveAaSlug('claude-sonnet-4', [
      aa({
        slug: 'claude-sonnet-4-6-adaptive',
        name: 'Claude Sonnet 4.6 (Adaptive)',
        intelligence: 48.4,
      }),
    ])

    expect(result).toMatchObject({ kind: 'declined' })
  })

  test('8 — no family member declines rather than guessing', () => {
    const result = autoResolveAaSlug('composer-2-5', [aa({ slug: 'gpt-5' })])

    expect(result).toMatchObject({
      kind: 'declined',
      reason: expect.stringContaining('composer-2-5'),
    })
  })

  test('9 — a family with no intelligence score declines', () => {
    const result = autoResolveAaSlug('mystery-1', [
      aa({ slug: 'mystery-1', name: 'Mystery 1', intelligence: null }),
    ])

    expect(result).toMatchObject({
      kind: 'declined',
      reason: expect.stringContaining('intelligence'),
    })
  })
})
