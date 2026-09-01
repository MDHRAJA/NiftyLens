# NiftyLens

NiftyLens is an explainable Indian-market research dashboard for retail investors. It combines a Nifty 50 market view, tracked NSE constituents, reported company earnings, a browser-local portfolio plan, and a grounded Gemini review.

> Educational research only. NiftyLens is not a broker, does not place trades, and does not provide guaranteed returns or buy/sell instructions.

## Features

- **Live-delayed market view** — Nifty 50 and five tracked NSE constituents are retrieved server-side and cached briefly.
- **Reported earnings context** — latest available quarterly net-income value and reporting date for each tracked company.
- **Multiple portfolios and holdings** — users can name separate portfolios, add several companies with allocation percentages, and retain the unallocated balance as cash/other.
- **1–10 risk appetite** — meaningful Capital first, Balanced, Growth focused, and High growth bands replace a coarse three-choice setting.
- **Automatic AI review** — deterministic scenario cards render first; the Gemini review then loads automatically beneath them.
- **Grounded market claims** — source URL, timestamp, and evidence IDs are supplied to Gemini. Without evidence, it may only discuss the plan facts entered by the user.
- **Resilient behaviour** — if a live feed or Gemini is unavailable, the interface clearly falls back rather than fabricating a market insight.

## Stack

| Layer | Technology |
| --- | --- |
| UI | Static HTML, CSS and vanilla JavaScript |
| Local development server | Node.js built-in `http` module |
| Production API | Vercel Functions (`.mjs`) |
| Market and fundamental data | Yahoo Finance delayed quote and fundamentals endpoints |
| AI plan review | Gemini Developer API, called only from the Vercel function |
| Client storage | Browser `localStorage` (`niftylens-portfolios-v3`) |

## Prerequisites

- [Node.js](https://nodejs.org/) **20 or later** (Node 22 LTS is recommended).
- npm, installed alongside Node.js.
- A Gemini API key only if you want AI reviews in a Vercel deployment.
- Git, if cloning from GitHub.

Check your tooling:

```powershell
node --version
npm --version
git --version
```

## Get started

### 1. Clone the repository

```powershell
git clone https://github.com/MDHRAJA/NiftyLens.git
cd NiftyLens
```

### 2. Install npm metadata

```powershell
npm install
```

The project deliberately has **no third-party npm runtime dependencies** today. Running `npm install` still verifies the project metadata and prepares the usual npm workflow.

### 3. Run locally

```powershell
npm start
```

Open [http://localhost:4173](http://localhost:4173).

To use a different port:

```powershell
$env:PORT=5000
npm start
```

On macOS/Linux:

```bash
PORT=5000 npm start
```

### Local-development behaviour

`npm start` runs `server.js`, a lightweight static server. It intentionally serves a deterministic local market snapshot and does not invoke Gemini. This keeps local UI work predictable and does not expose secrets.

The production Vercel routes are different:

- `GET /api/snapshot` — retrieves live-delayed market quotes and latest reported earnings; falls back to labelled demo data if a provider call fails.
- `POST /api/plan-review` — calls Gemini with portfolio facts and source-stamped evidence; falls back to a deterministic plan review if needed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Validates/install project metadata. There are currently no external dependencies. |
| `npm start` | Starts the local static server at `http://localhost:4173`. |
| `npm test` | Runs the Node built-in test suite in `test/`. |

Useful checks before committing:

```powershell
node --check public/app.js
git diff --check
npm test
```

### Test coverage

The repository includes evaluator-friendly Node tests with no external test dependency:

- `test/plan-review.test.mjs` checks multi-holding portfolio facts and method validation.
- `test/snapshot.test.mjs` mocks quote/fundamentals providers and checks the live snapshot, earnings evidence, and constituent count.

Run them with `npm test` (or `node --test` if your machine’s npm installation is unavailable).

## Environment variables

Copy the variable names from `.env.example`. **Never commit a real API key** or prefix it with `VITE_` / `NEXT_PUBLIC_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes, for Gemini reviews | Gemini Developer API key; server-side only. |
| `GEMINI_MODEL` | Optional | Primary Gemini model. Defaults to `gemini-3.7-flash`. |
| `GEMINI_FALLBACK_MODELS` | Optional | Comma-separated fallback sequence if the primary model is unavailable. |

Example:

```text
GEMINI_API_KEY=replace_with_your_key
GEMINI_MODEL=gemini-3.7-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite
```

The browser never receives the API key or selected model name. A Vercel deployment must be redeployed after an environment-variable change.

## Deploy to Vercel

1. Push the desired code to the `main` branch.
2. In Vercel, choose **Add New → Project**, import `MDHRAJA/NiftyLens`, and use the **Other** framework preset.
3. Open **Project Settings → Environment Variables**.
4. Add `GEMINI_API_KEY` for **Production**. Add the optional model variables if you need to override defaults.
5. Deploy. If you add or edit a variable later, open **Deployments** and redeploy the newest production deployment.
6. Open the production URL, then hard-refresh (`Ctrl + F5`) after a CSS or JavaScript change.

`vercel.json` sets the function duration to 60 seconds because a structured Gemini review can take longer than a minimal static API call.

## Data sources and refresh model

| Data | Endpoint behaviour | UI label |
| --- | --- | --- |
| Nifty 50 and tracked NSE prices | Server-side delayed quote requests; response cache: 60 seconds | `Live delayed quotes` |
| Latest quarterly net income | Server-side reported-fundamentals request per tracked company | `Latest net income` with reporting date |
| NSE filings, SEBI, RBI | Primary-research links in the Source Register | `Research source` |
| Feed failure | Controlled static snapshot only | `Demo fallback` / `Feed unavailable` |

The current primary-research links are not a replacement for full filing ingestion. Before relying on a financial figure, open the linked official source and verify it.

## AI safety and grounding

The plan-review function calculates facts from the user’s input, including portfolio value, allocation amount, monthly contribution, horizon and total planned contribution. Gemini receives only those facts plus valid evidence records.

It is instructed to:

- avoid buy/sell recommendations and guaranteed returns;
- only make a factual market claim when it has a supplied evidence ID;
- state when market evidence is unavailable;
- still provide a useful plan-based review based on deterministic inputs.

If Gemini returns an unavailable or malformed response, NiftyLens uses a deterministic calculation-based review instead of leaving an empty card.

## Project structure

```text
NiftyLens/
├── api/
│   ├── snapshot.mjs          # live delayed market quotes and earnings evidence
│   └── plan-review.mjs       # grounded Gemini review and safe fallback
├── public/
│   ├── index.html            # dashboard and portfolio dialog
│   ├── app.js                # rendering, local portfolio state, review lifecycle
│   └── *.css                 # responsive dashboard styles
├── server.js                 # local static server and deterministic local snapshot
├── package.json              # npm scripts and Node requirement
├── vercel.json               # Vercel function and security configuration
└── .env.example              # required environment-variable names
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Old UI after deployment | Use `Ctrl + F5`, then confirm the newest deployment is assigned to the production domain. |
| “AI review is unavailable” or fallback review | Verify `GEMINI_API_KEY` exists in the same Vercel project and is enabled for **Production**; redeploy afterward. |
| AI review takes too long | Check Vercel Function logs and Gemini quota. The configured maximum duration is 60 seconds. |
| Dashboard says Demo fallback | The delayed data provider was unavailable for that request; retry after a minute. |
| Local app differs from production data | Expected: `server.js` uses a deterministic snapshot; Vercel runs `api/snapshot.mjs`. |
| Git says “dubious ownership” on Windows | Add the repository’s exact path as a Git safe directory, then retry. |

## Limitations

- Market quotes are delayed and are not suitable for executing trades.
- Reported earnings data is not a substitute for reading official NSE filings.
- Scenario cards are illustrations, not forecasts.
- No broker is connected; the app cannot view or trade a real investment account.

