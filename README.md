# Cursor Model Picker

A public static site on GitHub Pages that helps you choose a Cursor model — three score
charts, a cost/quality scatter with a Pareto frontier, and a sortable table of all 47 models.

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
tokens to every price of eligible third-party models. Cursor's own models (Grok, Composer)
and a published exclusion list are exempt. It barely moves output prices but can multiply
cache-read prices several times over, which reorders the Pareto frontier.

The refresh reads the rate and the exclusion list from the same Cursor pricing page as the
model table, and records each model's eligibility in the snapshot. The **Cursor Token Rate
(Teams/Enterprise)** checkbox next to the X axis, on by default, adds it to every price shown
in the chart, tooltip and table. Untick it if you are on an individual plan.

A snapshot written before this (schema version 1) is reported as stale: run
`npm run refresh` again and drop the new `data/models.json`.

Data: Artificial Analysis (artificialanalysis.ai)
