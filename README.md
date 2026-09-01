# NiftyLens

An explainable India-market intelligence dashboard for retail investors. It starts from the Nifty 50, drills into constituent evidence, and changes its research guidance according to the user's risk profile and portfolio concentration.

## Run it

```powershell
node server.js
```

Open `http://localhost:4173`.

## What works now

- A readable Nifty 50 dashboard with three independent signal dimensions.
- Constituent-level research table and evidence state.
- Profile switch that demonstrates different output on the same market input.
- A browser-local portfolio form for self-entered value, allocation, risk, horizon and goal.
- A visible source register for NSE, SEBI, RBI and AMFI.
- A transparent demo-data mode, designed to survive unavailable feeds.

## Source strategy

| Source | Intended role |
| --- | --- |
| Upstox Market Data Feed | Authenticated live prices, OHLC and India VIX. The dashboard remains in demo mode until the WebSocket connector is implemented and verified; never label it live merely because an access token exists. |
| NSE All Reports | Cached Bhavcopy / EOD fallback and reproducible analysis. |
| NSE Corporate Filings | Quarterly results, announcements and citation-ready filings. |
| SEBI | Regulatory context and FPI data. |
| RBI DBIE | Macro context: policy rates, inflation and FX. |
| AMFI | Optional mutual-fund NAV and risk data. |

## Next implementation milestone

Add a server-side connector per source, cache each raw response with its source URL and retrieval time, ingest filing PDFs into a vector store, and make the three agent outputs follow a structured JSON contract. Never scrape undocumented endpoints at runtime or present stale data as live.

## Deploy to Vercel

1. Import `MDHRAJA/NiftyLens` into Vercel and leave the framework preset as **Other**.
2. Add `GEMINI_API_KEY` in **Project Settings → Environment Variables** for Production, Preview and Development. `GEMINI_MODEL` is optional and defaults to `gemini-3.7-flash`. Four fallback models (`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, and `gemini-3.1-flash-lite`) are retried automatically if the primary model is unavailable; override them with `GEMINI_FALLBACK_MODELS` if needed.
3. Deploy. Static UI is served from `public/`; the Gemini plan review runs server-side in `api/plan-review.mjs`.

The API key remains server-side; the browser sends only the plan fields the user entered. Without the key, the scenario engine remains usable and the UI says AI review is not configured.

## Grounded AI contract

Gemini always provides a plan review from user-entered values and deterministic portfolio facts. It is blocked from making market-specific claims unless a live data connector returns `mode: "live"` and verified evidence records in this shape:

```json
{
  "id": "nse-filing-2026-09-01",
  "claim": "The company filed its quarterly results.",
  "url": "https://www.nseindia.com/...",
  "asOf": "2026-09-01T12:45:00+05:30"
}
```

The API strips unknown evidence IDs. Plan-based suggestions remain available without market evidence, while market-specific claims require visible evidence. Scenario-return cards are calculations, not AI forecasts.
