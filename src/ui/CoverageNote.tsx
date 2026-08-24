export function CoverageNote({ shown, total }: { shown: number; total: number }) {
  return (
    <span className="coverage-note">
      {shown}/{total} shown
    </span>
  )
}
