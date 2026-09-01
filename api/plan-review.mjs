function json(body, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

function planFacts(plan = {}) {
  const years = plan.horizon === "1 year" ? 1 : plan.horizon === "3 years" ? 3 : 5;
  const value = Number(plan.value) || 0;
  const monthly = Number(plan.monthly) || 0;
  const holdings = Array.isArray(plan.holdings) ? plan.holdings.filter((holding) => holding?.symbol && Number(holding.allocation) > 0) : [];
  const dominant = [...holdings].sort((a, b) => Number(b.allocation) - Number(a.allocation))[0];
  const allocation = Number(dominant?.allocation ?? plan.allocation) || 0;
  const totalAllocation = holdings.length ? holdings.reduce((sum, holding) => sum + Number(holding.allocation || 0), 0) : allocation;
  return { years, portfolio_value_inr: value, monthly_contribution_inr: monthly, holding_count: holdings.length || 1, largest_holding_symbol: dominant?.symbol || plan.stock || "selected holding", largest_holding_percent: allocation, largest_holding_value_inr: Math.round(value * allocation / 100), holdings_allocation_percent: totalAllocation, other_holdings_or_cash_inr: Math.round(value * (100 - totalAllocation) / 100), contributions_over_horizon_inr: monthly * years * 12, total_contributed_inr: value + monthly * years * 12 };
}

function calculatedFallback(plan, facts) {
  const allocation = facts.largest_holding_percent;
  const concentration = allocation >= 35;
  const shortHorizon = facts.years < 3;
  const monthlyText = facts.monthly_contribution_inr
    ? `Your planned monthly contribution is ₹${facts.monthly_contribution_inr.toLocaleString("en-IN")}, adding ₹${facts.contributions_over_horizon_inr.toLocaleString("en-IN")} over ${facts.years} year${facts.years === 1 ? "" : "s"}.`
    : "There is no monthly contribution in this plan, so the outcome depends entirely on the starting portfolio and market movement.";
  return {
    headline: concentration ? "Your single-stock allocation deserves a measured review." : "Your allocation leaves room for diversification.",
    assessment: `Your largest position is ${facts.largest_holding_symbol} at ₹${facts.largest_holding_value_inr.toLocaleString("en-IN")} (${allocation}%). ${facts.holding_count} holding${facts.holding_count === 1 ? "" : "s"} account for ${facts.holdings_allocation_percent}% of the ₹${facts.portfolio_value_inr.toLocaleString("en-IN")} portfolio. ${monthlyText}`,
    better_approach: concentration
      ? `Consider setting a maximum position size and directing new contributions toward holdings or diversified instruments that reduce dependence on one company. Review the target allocation at a regular interval instead of reacting to daily price moves.`
      : `Keep the allocation rule explicit: decide how much of future contributions goes to the selected stock versus diversified holdings, then review it at a regular interval instead of changing it after daily price moves.`,
    risks: [
      concentration ? `${facts.largest_holding_symbol} represents ${allocation}% of the portfolio, so company-specific news can materially affect the overall value.` : `The largest holding can still be volatile even though it is below one-third of the portfolio.`,
      shortHorizon ? `A ${facts.years}-year horizon may be too short to rely on equity returns for a fixed goal date.` : `A ${facts.years}-year horizon still requires reassessing risk as the goal date approaches.`,
      facts.monthly_contribution_inr ? `Missing contributions would reduce the planned ₹${facts.contributions_over_horizon_inr.toLocaleString("en-IN")} contribution amount.` : "Without ongoing contributions, recovery from a market decline may take longer."
    ],
    questions: [
      "What is the maximum percentage you are comfortable keeping in one company?",
      "Would your goal still be on track if the selected stock fell before the horizon ends?",
      "How will you review and rebalance the allocation without reacting to short-term moves?"
    ],
    market_evidence_status: "unavailable",
    evidence_ids: []
  };
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const { plan = {}, marketContext } = await request.json();
      const evidence = Array.isArray(marketContext?.evidence) ? marketContext.evidence : [];
      const validEvidence = evidence.filter((item) => item.id && item.claim && item.url && item.asOf && /^https:\/\//.test(item.url));
      const evidenceIds = validEvidence.map((item) => item.id);
      const facts = planFacts(plan);
      if (!process.env.GEMINI_API_KEY) return json({ configured: false, grounded: true, fallback: true, fallbackReason: "missing_api_key", review: calculatedFallback(plan, facts), evidence: [], planFacts: facts });
      const prompt = `You are an educational Indian retail-investment research assistant. Provide a useful plan review based ONLY on the user plan and calculated plan facts below. Never use outside knowledge. Do not make a buy/sell recommendation, guarantee returns, or provide individualized financial advice. You may make plan-based suggestions about diversification, contribution consistency, time horizon and concentration using the calculated facts. You may make a factual MARKET claim only if it cites one or more supplied evidence IDs. If there is no market evidence, state that market-specific analysis is unavailable, but still give plan-based suggestions. User plan: ${JSON.stringify(plan)}. Calculated plan facts: ${JSON.stringify(facts)}. Evidence: ${JSON.stringify(validEvidence)}. Return strict JSON: {"headline":"string","assessment":"string","better_approach":"string","risks":["string"],"questions":["string"],"market_evidence_status":"available or unavailable","evidence_ids":["IDs only from: ${evidenceIds.join(", ") || "none"}"]}.`;
      const defaults = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
      const configuredFallbacks = (process.env.GEMINI_FALLBACK_MODELS || defaults.slice(1).join(",")).split(",").map((model) => model.trim()).filter(Boolean);
      const models = [...new Set([process.env.GEMINI_MODEL || defaults[0], ...configuredFallbacks])];
      let payload; let selectedModel; const failures = [];
      for (const model of models) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "low" } } })
        });
        if (response.ok) { payload = await response.json(); selectedModel = model; break; }
        failures.push(`${model}: ${response.status}`);
      }
      if (!payload) return json({ configured: false, grounded: true, fallback: true, fallbackReason: "gemini_models_unavailable", providerStatusCodes: failures.map((failure) => failure.split(": ").at(-1)), review: calculatedFallback(plan, facts), evidence: [], planFacts: facts });
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      const review = parseJson(text);
      if (!review) return json({ configured: false, grounded: true, fallback: true, fallbackReason: "invalid_gemini_response", providerFinishReason: payload.candidates?.[0]?.finishReason || payload.promptFeedback?.blockReason || "no_candidate", generatedTextLength: text.length, review: calculatedFallback(plan, facts), evidence: [], planFacts: facts });
      review.evidence_ids = (review.evidence_ids || []).filter((id) => evidenceIds.includes(id));
      return json({ configured: true, grounded: true, review, evidence: validEvidence.filter((item) => review.evidence_ids.includes(item.id)), planFacts: facts });
    } catch (error) {
      return json({ configured: false, grounded: true, fallback: true, fallbackReason: "request_processing_failed", review: calculatedFallback({}, planFacts({})), evidence: [], planFacts: planFacts({}) });
    }
  }
};

