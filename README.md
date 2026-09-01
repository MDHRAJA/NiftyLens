# NiftyLens

NiftyLens is an explainable Indian-market research dashboard for retail investors. It combines a live-delayed Nifty 50 market view, company-level price and earnings context, a self-entered portfolio plan, and a grounded Gemini review.

It is an educational research tool, not a broker, trade-execution product, or return-prediction service.

## What it does

- Shows the latest delayed Nifty 50 price and day move.
- Tracks five large NSE constituents with current delayed price movement.
- Ingests the latest available quarterly net-income figure and report date for every tracked company.
- Labels the source state honestly. If the live feed is unavailable, the dashboard switches to an explicit demo fallback.
- Keeps portfolio entries in browser storage only; no broker account or preset portfolio is used.
- Uses a 1–10 risk-appetite scale with clear Capital first, Balanced, Growth focused, and High growth bands.
- Displays deterministic projection scenarios first, then loads an automatic Gemini plan review underneath.
- Grounds market claims in visible evidence records; when evidence is unavailable, the review is limited to the portfolio facts entered by the user.

## Data and evidence

| Data | Current implementation | State |
| --- | --- | --- |
| Nifty 50 and tracked constituent prices | Yahoo Finance delayed market quotes, fetched server-side | Live delayed, cached for 60 seconds |
| Latest company net income | Yahoo Finance reported quarterly fundamentals, fetched server-side | Live reported data when available |
| NSE filings, SEBI, RBI | Visible source register for primary research and verification | Linked research sources |
| Portfolio plan | Browser-local, user-entered fields | Private to the browser |

The dashboard never calls fallback numbers “live.” Source URLs and timestamps travel with the evidence supplied to the AI plan review.

## Run locally

Requirements: Node.js 20 or later.

```powershell
node server.js
```

Open `http://localhost:4173`.

The local static server serves the user interface and a local snapshot route. For the Vercel Gemini endpoint, deploy the project with the environment variables below.

## Deploy to Vercel

1. Import `MDHRAJA/NiftyLens` and select the **Other** framework preset.
2. Add these Project Environment Variables for **Production** (and Preview if desired):

```text
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.7-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite
```

3. Deploy or redeploy after changing an environment variable.

The key is only read by `api/plan-review.mjs`. It is never rendered in the client and runtime model details are not returned to the browser.

## Grounded AI behaviour

`api/plan-review.mjs` first calculates portfolio facts such as stock value, allocation, horizon, and planned contributions. Gemini receives those facts plus source-stamped evidence. It is instructed to:

- avoid buy/sell instructions and guaranteed-return claims;
- make market-specific claims only when evidence IDs are provided;
- offer a plan-based review even when market evidence is unavailable.

If Gemini is unavailable or cannot return a safe structured answer, NiftyLens returns a deterministic calculation-based review rather than an empty panel or fabricated market insight.

## Project structure

```text
api/
  snapshot.mjs       live delayed quotes and earnings evidence
  plan-review.mjs    grounded Gemini portfolio review
public/
  index.html         dashboard and portfolio input dialog
  app.js             rendering, local portfolio state, review lifecycle
  *.css              responsive dashboard styling
server.js            simple local static server
```

## Important limitations

- Market quotes are delayed and should not be used for trading decisions.
- The earnings feed provides reported financial values, not a substitute for reading primary NSE filings.
- Scenario cards are illustrations, not forecasts.
- The application does not connect to a broker or place trades.

