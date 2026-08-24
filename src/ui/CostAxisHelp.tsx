export function CostAxisHelp() {
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip__trigger"
        aria-label="About cost axes"
        aria-describedby="cost-axis-help"
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      <div id="cost-axis-help" role="tooltip" className="info-tip__popover">
        <p className="info-tip__title">Choosing a cost axis</p>
        <p>
          Each option uses Cursor&apos;s published <strong>$/1M tokens</strong> for that billing
          category. The Pareto frontier recomputes when you switch.
        </p>
        <dl className="info-tip__list">
          <div className="info-tip__item">
            <dt>Input price</dt>
            <dd>You care about prompt/context ingestion cost. Good default.</dd>
          </div>
          <div className="info-tip__item">
            <dt>Output price</dt>
            <dd>The model writes a lot (code, long answers). Output is priced higher per token.</dd>
          </div>
          <div className="info-tip__item">
            <dt>Cache read price</dt>
            <dd>You run long sessions where the same context is re-read (agents, big repos).</dd>
          </div>
        </dl>
        <p className="info-tip__note">
          <strong>Your recent usage (Jul–Aug 2026):</strong> ~138M input · ~18M output · ~2.7B cache
          read tokens. Cache read dominated both volume and spend — try that axis if you&apos;re
          picking a model for heavy agent work.
        </p>
      </div>
    </span>
  )
}
