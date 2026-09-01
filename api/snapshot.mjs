const trackedCompanies = [
  { yahoo: "HDFCBANK.NS", symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", weight: 12.9 },
  { yahoo: "RELIANCE.NS", symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", weight: 9.1 },
  { yahoo: "INFY.NS", symbol: "INFY", name: "Infosys", sector: "IT", weight: 5.7 },
  { yahoo: "ICICIBANK.NS", symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", weight: 8.1 },
  { yahoo: "ITC.NS", symbol: "ITC", name: "ITC", sector: "Consumer", weight: 3.4 }
];

const fallbackSnapshot = {
  asOf: "Demo snapshot — feed unavailable", mode: "demo", evidence: [],
  index: { name: "NIFTY 50", value: 24896.4, change: 0.63, breadth: "32 gainers / 18 losers", status: "Demo data" },
  signals: [
    { label: "Data status", value: "Demo fallback", detail: "Live delayed feed could not be reached", confidence: 0 },
    { label: "Market breadth", value: "Unavailable", detail: "Reconnect to refresh live quotes", confidence: 0 },
    { label: "Market mood", value: "Unavailable", detail: "No live inference is shown in fallback mode", confidence: 0 }
  ],
  constituents: trackedCompanies.map((company, index) => ({ ...company, move: [1.42, 0.91, -0.64, 1.08, -0.28][index], signal: "Demo", filing: "Live quote feed unavailable" }))
};

function sources(live) {
  return [
    { name: "Yahoo Finance delayed quotes", kind: "Live Nifty 50 and tracked NSE constituent prices", url: "https://finance.yahoo.com/quote/%5ENSEI", state: live ? "Live delayed feed" : "Feed unavailable" },
    { name: "NSE market reports", kind: "Exchange market data", url: "https://www.nseindia.com/all-reports/", state: "Research source" },
    { name: "NSE corporate filings", kind: "Quarterly results and announcements", url: "https://www.nseindia.com/companies-listing/corporate-filings-financial-results", state: "Research source" },
    { name: "SEBI statistics", kind: "FPI flows and regulation", url: "https://www.sebi.gov.in/reports-and-statistics.html", state: "Research source" },
    { name: "RBI DBIE", kind: "Rates, FX, inflation and macro", url: "https://dbieold.rbi.org.in/DBIE/", state: "Research source" }
  ];
}

async function quote(symbol) {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, { headers: { "user-agent": "NiftyLens/1.0" } });
  if (!response.ok) throw new Error(`Quote request failed: ${response.status}`);
  const meta = (await response.json()).chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  const previous = Number(meta?.chartPreviousClose || meta?.regularMarketPreviousClose);
  if (!Number.isFinite(price) || !Number.isFinite(previous) || previous === 0) throw new Error("Quote payload was incomplete");
  return { price, move: Number((((price - previous) / previous) * 100).toFixed(2)), timestamp: meta.regularMarketTime };
}

async function latestEarnings(symbol) {
  const start = Math.floor(Date.UTC(2024, 0, 1) / 1000);
  const end = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=quarterlyNetIncome&merge=false&period1=${start}&period2=${end}`;
  const response = await fetch(url, { headers: { "user-agent": "NiftyLens/1.0" } });
  if (!response.ok) throw new Error(`Earnings request failed: ${response.status}`);
  const rows = (await response.json()).timeseries?.result?.[0]?.quarterlyNetIncome || [];
  const latest = [...rows].sort((a, b) => String(a.asOfDate).localeCompare(String(b.asOfDate))).at(-1);
  const value = Number(latest?.reportedValue?.raw);
  if (!latest?.asOfDate || !Number.isFinite(value)) throw new Error("Earnings payload was incomplete");
  return { date: latest.asOfDate, value, url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/financials/` };
}

function crore(value) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value / 10_000_000))} Cr`;
}

function asOf(timestamp) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date((timestamp || Date.now() / 1000) * 1000)) + " IST";
}

async function liveSnapshot() {
  const [indexQuote, ...companyQuotes] = await Promise.all([quote("^NSEI"), ...trackedCompanies.map((company) => quote(company.yahoo))]);
  const earnings = await Promise.all(trackedCompanies.map((company) => latestEarnings(company.yahoo).catch(() => null)));
  const constituents = trackedCompanies.map((company, index) => {
    const item = companyQuotes[index];
    const report = earnings[index];
    return { ...company, move: item.move, signal: item.move > 0.3 ? "Up today" : item.move < -0.3 ? "Down today" : "Near flat", filing: report ? `Latest net income: ${crore(report.value)} · quarter ended ${report.date}` : "Financial report temporarily unavailable", report };
  });
  const gainers = constituents.filter((item) => item.move > 0).length;
  const losers = constituents.filter((item) => item.move < 0).length;
  const positive = indexQuote.move >= 0;
  const liveAsOf = asOf(indexQuote.timestamp);
  return {
    asOf: liveAsOf, mode: "live",
    evidence: [
      { id: "NIFTY-LIVE-QUOTE", claim: `NIFTY 50 quote at ${indexQuote.price.toLocaleString("en-IN")} (${indexQuote.move >= 0 ? "+" : ""}${indexQuote.move}% vs previous close)`, url: "https://finance.yahoo.com/quote/%5ENSEI", asOf: liveAsOf },
      ...earnings.flatMap((report, index) => report ? [{ id: `${trackedCompanies[index].symbol}-LATEST-EARNINGS`, claim: `${trackedCompanies[index].symbol} reported net income of ${crore(report.value)} for quarter ended ${report.date}`, url: report.url, asOf: report.date }] : [])
    ],
    index: { name: "NIFTY 50", value: indexQuote.price, change: indexQuote.move, breadth: `${gainers} gainers / ${losers} losers in tracked basket`, status: positive ? "Up today" : "Down today" },
    signals: [
      { label: "Nifty 50", value: positive ? "Up today" : "Down today", detail: `${indexQuote.move >= 0 ? "+" : ""}${indexQuote.move}% against previous close`, confidence: Math.min(100, Math.round(Math.abs(indexQuote.move) * 25 + 50)) },
      { label: "Tracked basket", value: `${gainers} up · ${losers} down`, detail: "Five NSE constituents monitored in this dashboard", confidence: Math.round((gainers / constituents.length) * 100) },
      { label: "Data status", value: "Live delayed quotes", detail: `Last market timestamp: ${liveAsOf}`, confidence: 100 }
    ],
    constituents, sources: sources(true)
  };
}

export default {
  async fetch() {
    let snapshot;
    try { snapshot = await liveSnapshot(); } catch { snapshot = { ...fallbackSnapshot, sources: sources(false) }; }
    return Response.json(snapshot, { headers: { "cache-control": "s-maxage=60, stale-while-revalidate=120" } });
  }
};

