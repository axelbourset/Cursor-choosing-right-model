import { describe, expect, test } from 'vitest'
import { deriveCursorSlug } from './slug'

describe('deriveCursorSlug', () => {
  test('1 — lowercases and dash-flattens punctuation', () => {
    expect(deriveCursorSlug('Claude Opus 4.7 (fast mode)')).toBe('claude-opus-4-7-fast-mode')
    expect(deriveCursorSlug('GPT-5.1 Codex Mini')).toBe('gpt-5-1-codex-mini')
    expect(deriveCursorSlug('GLM 5.2')).toBe('glm-5-2')
    expect(deriveCursorSlug('Kimi K2.7 Code')).toBe('kimi-k2-7-code')
  })

  test('2 — collapses runs and trims leading and trailing separators', () => {
    expect(deriveCursorSlug('  Grok 4.6  (Fast)  ')).toBe('grok-4-6-fast')
    expect(deriveCursorSlug('...Model...')).toBe('model')
  })
})
