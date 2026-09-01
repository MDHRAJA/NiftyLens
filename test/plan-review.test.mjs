import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/plan-review.mjs";

test("plan review fallback calculates multi-holding concentration without an API key", async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const request = new Request("http://localhost/api/plan-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      plan: {
        name: "Long term",
        value: 200000,
        monthly: 5000,
        horizon: "3 years",
        risk: 5,
        holdings: [{ symbol: "HDFCBANK", allocation: 30 }, { symbol: "INFY", allocation: 20 }]
      },
      marketContext: { evidence: [] }
    })
  });
  const response = await handler.fetch(request);
  const data = await response.json();
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  assert.equal(response.status, 200);
  assert.equal(data.fallback, true);
  assert.equal(data.planFacts.holding_count, 2);
  assert.equal(data.planFacts.largest_holding_symbol, "HDFCBANK");
  assert.match(data.review.assessment, /2 holdings/);
});

test("plan review rejects non-POST requests", async () => {
  const response = await handler.fetch(new Request("http://localhost/api/plan-review"));
  assert.equal(response.status, 405);
});

