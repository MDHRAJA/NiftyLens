import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/snapshot.mjs";

test("snapshot composes live quotes and reported earnings evidence", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("fundamentals-timeseries")) {
      return { ok:true, json:async () => ({ timeseries:{ result:[{ quarterlyNetIncome:[{ asOfDate:"2026-03-31", reportedValue:{ raw:15000000000 } }] }] } }) };
    }
    const symbol = decodeURIComponent(target.split("/chart/")[1].split("?")[0]);
    const prices = { "^NSEI":24000, "HDFCBANK.NS":800, "RELIANCE.NS":1400, "INFY.NS":1500, "ICICIBANK.NS":1300, "ITC.NS":300 };
    return { ok:true, json:async () => ({ chart:{ result:[{ meta:{ regularMarketPrice:prices[symbol], chartPreviousClose:prices[symbol] - 10, regularMarketTime:1774915200 } }] } }) };
  };
  const response = await handler.fetch(new Request("http://localhost/api/snapshot"));
  const data = await response.json();
  global.fetch = originalFetch;
  assert.equal(response.status, 200);
  assert.equal(data.mode, "live");
  assert.equal(data.constituents.length, 5);
  assert.equal(data.evidence.length, 6);
  assert.match(data.constituents[0].filing, /Latest net income/);
});

