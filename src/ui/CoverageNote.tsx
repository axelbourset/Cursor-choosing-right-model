export function CoverageNote({ shown, total }: { shown: number; total: number }) {
  return (
    <span>
      {shown}/{total} shown
    </span>
  )
}
