export function CoverageNote({ shown, total }: { readonly shown: number; readonly total: number }) {
  return (
    <span className="coverage-note">
      {shown}/{total} shown
    </span>
  )
}
