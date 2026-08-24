/**
 * Squircle shape utilities.
 *
 * The canonical curve is `corner-shape: squircle`, which MDN equates to `superellipse(2)`.
 * This module generates the SVG fallback path for that curve so the fallback
 * (inside `@supports not (corner-shape: squircle)`) matches the native majority path.
 *
 * The path is a rounded rectangle whose corners are superellipse(2) arcs, approximated
 * with cubic Bézier segments. `radius` is clamped to `min(w, h) / 2` so the shape can
 * never self-intersect; a radius of 0 degenerates to a plain rectangle.
 */

/** Clamp a number to an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// The circle kappa (0.5522847…) is a tight upper bound for a superellipse(2) quarter arc.
// The squircle is only slightly more squared than a circle, so the same kappa keeps the
// path stable and pure; the visual deviation from a true n=2 fit is sub-pixel at normal zoom.
const K = 0.5522847498307936

/**
 * A cubic Bézier `C` command (two control points + end point). The start point is
 * implicit — it is the previous command's end.
 */
function cubic(
  cp1X: number,
  cp1Y: number,
  cp2X: number,
  cp2Y: number,
  endX: number,
  endY: number,
): string {
  return `C ${cp1X.toFixed(3)} ${cp1Y.toFixed(3)}, ${cp2X.toFixed(3)} ${cp2Y.toFixed(3)}, ${endX.toFixed(3)} ${endY.toFixed(3)}`
}

/**
 * SVG path for a superellipse(2) squircle, matching `corner-shape: squircle`.
 *
 * The path is closed (`Z`) and uses cubic curves for every non-zero-radius corner.
 * A negative radius is clamped to 0 (degenerate rectangle).
 */
export function squirclePath(width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) {
    throw new Error(`squirclePath requires positive dimensions, got ${width}x${height}`)
  }
  const r = clamp(radius, 0, Math.min(width, height) / 2)

  // Rectangle degenerate case — no curves, no self-intersection.
  if (r === 0) {
    return `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`
  }

  const k = K * r
  // Corner anchor points, clockwise from the top edge.
  const topStartX = r // top edge starts after the top-left corner
  const leftTopY = r // left edge starts after the top-left corner
  const rightTopY = r // right edge starts after the top-right corner
  const bottomRightX = width - r // bottom edge ends before the bottom-right corner
  const bottomLeftX = r // bottom edge starts before the bottom-left corner
  const leftBottomY = height - r // left edge ends before the bottom-left corner
  const rightBottomY = height - r // right edge ends before the bottom-right corner

  return [
    // Start at the top edge, just past the top-left corner.
    `M ${topStartX.toFixed(3)} 0`,
    // Top edge to the top-right corner start.
    `L ${bottomRightX.toFixed(3)} 0`,
    // Top-right corner: arc to (width, rightTopY).
    cubic(bottomRightX + k, 0, width, rightTopY - k, width, rightTopY),
    // Right edge to the bottom-right corner start.
    `L ${width.toFixed(3)} ${rightBottomY.toFixed(3)}`,
    // Bottom-right corner: arc to (bottomRightX, height).
    cubic(width, rightBottomY + k, bottomRightX + k, height, bottomRightX, height),
    // Bottom edge to the bottom-left corner start.
    `L ${bottomLeftX.toFixed(3)} ${height.toFixed(3)}`,
    // Bottom-left corner: arc to (0, leftBottomY).
    cubic(bottomLeftX - k, height, 0, leftBottomY + k, 0, leftBottomY),
    // Left edge to the top-left corner start.
    `L 0 ${leftTopY.toFixed(3)}`,
    // Top-left corner: arc back to (topStartX, 0).
    cubic(0, leftTopY - k, topStartX - k, 0, topStartX, 0),
    `Z`,
  ].join(' ')
}

/**
 * A `clip-path: path("…")` value for the squircle, for the `@supports not` fallback.
 * The string is wrapped in `path("…")` so it can be assigned to `clip-path` directly.
 */
export function squircleClipPath(width: number, height: number, radius: number): string {
  return `path("${squirclePath(width, height, radius)}")`
}
