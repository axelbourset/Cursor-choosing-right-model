import { describe, expect, test } from 'vitest'
import { squircleClipPath, squirclePath } from './squircle'

describe('squirclePath', () => {
  test('1 — squirclePath(100,100,16) returns a string starting with M and containing C (cubic curves)', () => {
    const path = squirclePath(100, 100, 16)
    expect(path.startsWith('M')).toBe(true)
    expect(path).toContain('C')
  })

  test('2 — the path is closed (ends with Z)', () => {
    const path = squirclePath(100, 100, 16)
    expect(path.endsWith('Z')).toBe(true)
  })

  test('3 — radius 0 degenerates to a plain rectangle path with no curves', () => {
    const path = squirclePath(100, 100, 0)
    expect(path).not.toContain('C')
    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path).toContain('L 100 0')
    expect(path).toContain('L 100 100')
    expect(path).toContain('L 0 100')
    expect(path.endsWith('Z')).toBe(true)
  })

  test('4 — radius greater than min(w,h)/2 is clamped to min(w,h)/2 with no self-intersection', () => {
    // For a 100x100 box, the max safe radius is 50. A request of 200 must clamp.
    const clamped = squirclePath(100, 100, 200)
    // The clamped path should equal the path requested at exactly 50.
    const atMax = squirclePath(100, 100, 50)
    expect(clamped).toBe(atMax)
    // No coordinate should exceed the box bounds — i.e. no self-intersection.
    // Every numeric token in the path lies within [0, 100].
    const nums = clamped.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(100)
    }
  })

  test('5 — squirclePath(100,50,16) uses both dimensions and differs from squirclePath(50,100,16)', () => {
    const wide = squirclePath(100, 50, 16)
    const tall = squirclePath(50, 100, 16)
    expect(wide).not.toBe(tall)
    // The wide path reaches x=100; the tall path reaches y=100.
    expect(wide).toContain('100')
    expect(tall).toContain('100')
  })

  test('6 — squircleClipPath(100,100,16) is wrapped in path("…")', () => {
    const clip = squircleClipPath(100, 100, 16)
    expect(clip.startsWith('path("')).toBe(true)
    expect(clip.endsWith('")')).toBe(true)
    // The inner content is a valid path string starting with M.
    const inner = clip.slice('path("'.length, -'")'.length)
    expect(inner.startsWith('M')).toBe(true)
    expect(inner.endsWith('Z')).toBe(true)
  })

  test('7 — a negative radius is clamped to 0 (degenerate rectangle)', () => {
    const path = squirclePath(100, 100, -20)
    expect(path).not.toContain('C')
    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
  })

  test('8 — the same inputs twice produce byte-identical output (pure, no randomness)', () => {
    const a = squirclePath(100, 100, 16)
    const b = squirclePath(100, 100, 16)
    expect(a).toBe(b)
    expect(squircleClipPath(80, 60, 12)).toBe(squircleClipPath(80, 60, 12))
  })
})
