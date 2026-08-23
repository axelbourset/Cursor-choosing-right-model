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

Data: Artificial Analysis (artificialanalysis.ai)
