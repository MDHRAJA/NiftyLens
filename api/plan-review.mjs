function json(body, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

function planFacts(plan) {
  const years = plan.horizon === "1 year" ? 1 : plan.horizon === "3 years" ? 3 : 5;
  const value = Number(plan.value) || 0;
  const monthly = Number(plan.monthly) || 0;
  const allocation = Number(plan.allocation) || 0;
  return { years, portfolio_value_inr: value, monthly_contribution_inr: monthly, stock_allocation_percent: allocation, stock_value_inr: Math.round(value * allocation / 100), other_holdings_or_cash_inr: Math.round(value * (100 - allocation) / 100), contributions_over_horizon_inr: monthly * years * 12, total_contributed_inr: value + monthly * years * 12 };
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!process.env.GEMINI_API_KEY) return json({ configured: false, message: "AI review needs GEMINI_API_KEY in the deployment environment." }, 503);
    try {
      const { plan, marketContext } = await request.json();
      const evidence = Array.isArray(marketContext?.evidence) ? marketContext.evidence : [];
      const validEvidence = evidence.filter((item) => item.id && item.claim && item.url && item.asOf && /^https:\/\//.test(item.url));
      const evidenceIds = validEvidence.map((item) => item.id);
      const facts = planFacts(plan);
      const prompt = `You are an educational Indian retail-investment research assistant. Provide a useful plan review based ONLY on the user plan and calculated plan facts below. Never use outside knowledge. Do not make a buy/sell recommendation, guarantee returns, or provide individualized financial advice. You may make plan-based suggestions about diversification, contribution consistency, time horizon and concentration using the calculated facts. You may make a factual MARKET claim only if it cites one or more supplied evidence IDs. If there is no market evidence, state that market-specific analysis is unavailable, but still give plan-based suggestions. User plan: ${JSON.stringify(plan)}. Calculated plan facts: ${JSON.stringify(facts)}. Evidence: ${JSON.stringify(validEvidence)}. Return strict JSON: {"headline":"string","assessment":"string","better_approach":"string","risks":["string"],"questions":["string"],"market_evidence_status":"available or unavailable","evidence_ids":["IDs only from: ${evidenceIds.join(", ") || "none"}"]}.`;
      const defaults = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
      const configuredFallbacks = (process.env.GEMINI_FALLBACK_MODELS || defaults.slice(1).join(",")).split(",").map((model) => model.trim()).filter(Boolean);
      const models = [...new Set([process.env.GEMINI_MODEL || defaults[0], ...configuredFallbacks])];
      let payload; let selectedModel; const failures = [];
      for (const model of models) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 700, responseMimeType: "application/json" } })
        });
        if (response.ok) { payload = await response.json(); selectedModel = model; break; }
        failures.push(`${model}: ${response.status}`);
      }
      if (!payload) throw new Error(`All Gemini models were unavailable (${failures.join(", ")})`);
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      const review = parseJson(text);
      if (!review) throw new Error("AI response was not valid structured output");
      review.evidence_ids = (review.evidence_ids || []).filter((id) => evidenceIds.includes(id));
      return json({ configured: true, grounded: true, model: selectedModel, review, evidence: validEvidence.filter((item) => review.evidence_ids.includes(item.id)), planFacts: facts });
    } catch (error) {
      return json({ configured: true, error: error.message }, 502);
    }
  }
};
