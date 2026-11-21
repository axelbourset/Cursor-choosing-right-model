# Cursor Model Picker

A public static site on GitHub Pages that helps you choose a Cursor model — three score
charts, a cost/quality scatter with a Pareto frontier, and a sortable table of every Cursor model.

No Artificial Analysis data is included in this repository or the deployed bundle. You generate
your own snapshot locally.

## Refresh a snapshot

1. **Get a key** — free, from https://artificialanalysis.ai/api-key-management-redirect
2. **Paste it** — `cp .env.example .env` then set `AA_API_KEY=...`
3. **Run it** — `npm install` then `npm run refresh`

The snapshot is written to `data/models.json` (gitignored, outside `public/`).

## Use the data

- **Locally:** `npm run dev` — Vite serves `data/models.json` via dev middleware
- **Hosted site:** drop `data/models.json` onto the public GitHub Pages site (file-drop zone)

Your API key never leaves your machine. Only `scripts/refresh` reads it; the deployed site
contains no key and makes no Artificial Analysis calls.

The free tier allows 100 requests/day shared across an organisation; one refresh costs 4 requests.

Offline without a key: `npm run refresh -- --fixture` (synthetic data).

## Cursor Token Rate

On Teams and Enterprise plans Cursor adds a flat
[Cursor Token Rate](https://cursor.com/docs/models-and-pricing#cursor-token-rate) per 1M
tokens to every price of eligible third-party models, including requests made with your own
API key (BYOK). Cursor's own models (Grok, Composer) are exempt, and so is every third-party
model whose cache-read price is strictly below a threshold Cursor publishes ($0.10 per 1M
tokens at the time of writing). The rate barely moves output prices but can multiply
cache-read prices several times over, which reorders the Pareto frontier.

The refresh reads the rate and the threshold from the same Cursor pricing page as the model
table, and decides each model's eligibility from the cache-read price stored in the
snapshot. Cursor applies the threshold "across every pricing tier", but tier prices only
appear in the table's free-text notes, so the refresh compares the listed price. A
third-party model with no cache-read price is counted as paying the rate, and the refresh
prints a WARNING naming it. The **Cursor Token Rate (Teams/Enterprise)** checkbox in the
chart's Pricing settings, on by default, adds it to every price shown in the chart, tooltip
and table. Untick it if you are on an individual plan.

A snapshot written before the threshold rule (schema version 1 or 2) is reported as stale:
pull the latest code, run `npm run refresh` again and drop the new `data/models.json`. A
snapshot newer than the page means the page is the out-of-date side: reload it and drop the
file again.

Data: Artificial Analysis (artificialanalysis.ai)
