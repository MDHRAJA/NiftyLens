const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");

const marketSnapshot = {
  asOf: "01 Sep 2026, 12:45 IST",
  mode: process.env.UPSTOX_ACCESS_TOKEN ? "connector-configured" : "demo",
  evidence: [],
  index: { name: "NIFTY 50", value: 24896.4, change: 0.63, breadth: "32 gainers / 18 losers", status: "Constructive" },
  signals: [
    { label: "Momentum", value: "Positive", detail: "Above 20-day and 50-day average", confidence: 78 },
    { label: "Volume", value: "Healthy", detail: "1.18× the 20-day average", confidence: 71 },
    { label: "Market mood", value: "Cautious optimism", detail: "FPI flows and volatility are mixed", confidence: 62 }
  ],
  constituents: [
    { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", move: 1.42, signal: "Supportive", weight: 12.9, filing: "Q1 results: stable asset quality" },
    { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", move: 0.91, signal: "Supportive", weight: 9.1, filing: "Latest filing available" },
    { symbol: "INFY", name: "Infosys", sector: "IT", move: -0.64, signal: "Watch", weight: 5.7, filing: "Guidance needs verification" },
    { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Automobile", move: 1.08, signal: "Supportive", weight: 2.1, filing: "Volume trend improving" },
    { symbol: "ITC", name: "ITC", sector: "Consumer", move: -0.28, signal: "Neutral", weight: 3.4, filing: "No material filing detected" }
  ],
  sources: [
    { name: "NSE market reports", kind: "Exchange market data", url: "https://www.nseindia.com/all-reports/", state: "Fallback ready" },
    { name: "NSE corporate filings", kind: "Quarterly results and announcements", url: "https://www.nseindia.com/companies-listing/corporate-filings-financial-results", state: "Citation source" },
    { name: "SEBI statistics", kind: "FPI flows and regulation", url: "https://www.sebi.gov.in/reports-and-statistics.html", state: "Context source" },
    { name: "RBI DBIE", kind: "Rates, FX, inflation and macro", url: "https://dbieold.rbi.org.in/DBIE/", state: "Context source" },
    { name: "AMFI", kind: "Mutual-fund NAV and risk data", url: "https://www.amfiindia.com/net-asset-value/nav-download", state: "Optional portfolio source" }
  ]
};

function send(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname === "/api/snapshot") return send(res, 200, "application/json", JSON.stringify(marketSnapshot));
  if (requestUrl.pathname === "/api/health") return send(res, 200, "application/json", JSON.stringify({ ok: true, mode: marketSnapshot.mode }));
  if (requestUrl.pathname === "/api/plan-review") return send(res, 503, "application/json", JSON.stringify({ configured: false, message: "AI review is disabled locally until verified market evidence is connected." }));

  const safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filename = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filename.startsWith(PUBLIC_DIR) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
    return send(res, 404, "text/plain; charset=utf-8", "Not found");
  }
  const extensions = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" };
  return send(res, 200, extensions[path.extname(filename)] || "application/octet-stream", fs.readFileSync(filename));
});

server.listen(PORT, () => console.log(`NiftyLens is running on http://localhost:${PORT}`));
