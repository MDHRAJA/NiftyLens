import snapshotHandler from "./snapshot.mjs";

const clamp = (value, low = 0, high = 100) => Math.max(low, Math.min(high, Math.round(value)));
const stance = (score) => score >= 62 ? "Bullish" : score <= 42 ? "Cautious" : "Neutral";
const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "s-maxage=60, stale-while-revalidate=120" } });

function momentumAgent(stock, asOf) {
  const score = clamp(50 + stock.move * 14);
  return { agent:"Momentum agent", stance:stance(score), score, evidence_id:`${stock.symbol}-LIVE-QUOTE`, rationale:`${stock.symbol} is ${stock.move >= 0 ? "up" : "down"} ${Math.abs(stock.move).toFixed(2)}% versus the previous close (${asOf}).` };
}

function earningsAgent(stock) {
  const hasReport = Number(stock.report?.value) > 0;
  const score = hasReport ? 58 : 45;
  return { agent:"Earnings agent", stance:stance(score), score, evidence_id:hasReport ? `${stock.symbol}-LATEST-EARNINGS` : null, rationale:hasReport ? `Latest reported quarterly net income is available for the period ended ${stock.report.date}; this confirms a current fundamental evidence point, not a growth forecast.` : "No current reported earnings value was available from the live fundamentals feed." };
}

function riskAgent(stock) {
  const absoluteMove = Math.abs(stock.move);
  const score = stock.move <= -1 ? 35 : stock.move < 0 ? 45 : absoluteMove > 3 ? 48 : stock.move > 0 ? 60 : 52;
  return { agent:"Risk agent", stance:stance(score), score, evidence_id:`${stock.symbol}-LIVE-QUOTE`, rationale:absoluteMove > 3 ? `A ${absoluteMove.toFixed(2)}% one-day move raises short-term volatility risk.` : stock.move < 0 ? "The current negative session keeps near-term downside risk in view." : "The current session is positive without an unusually large one-day move." };
}

export function buildResearch(snapshot) {
  return snapshot.constituents.map((stock) => ({ stock, agents:[momentumAgent(stock, snapshot.asOf), earningsAgent(stock), riskAgent(stock)] }));
}

export function ruleSynthesis(research) {
  return research.map(({ stock, agents }) => {
    const momentum = agents[0]; const earnings = agents[1]; const risk = agents[2];
    let finalStance = "Neutral"; let confidence = 54; let reason = "The independent agents are mixed, so the evidence does not support a strong directional conclusion.";
    if (momentum.stance === "Bullish" && risk.stance !== "Cautious" && earnings.stance !== "Cautious") { finalStance = "Bullish"; confidence = 68; reason = "Positive price action is supported by an available earnings evidence point and no short-term risk veto."; }
    if (momentum.stance === "Cautious" || risk.stance === "Cautious") { finalStance = "Cautious"; confidence = 66; reason = "The synthesis gives a downside or volatility veto more weight than positive evidence; it does not average the agent scores."; }
    return { symbol:stock.symbol, stance:finalStance, confidence, thesis:reason, evidence_ids:[...new Set(agents.map((agent) => agent.evidence_id).filter(Boolean))] };
  });
}

function parseJson(text) { const match = text.match(/\{[\s\S]*\}/); return match ? JSON.parse(match[0]) : null; }

async function aiSynthesis(research, evidence) {
  const prompt = `You are the fourth, final synthesis agent in an educational India-market research system. Form a final stance for each stock from the independent agent outputs and supplied live evidence. Do NOT average scores. Give more weight to agreement, conflict, downside/volatility vetoes, and source quality. Use ONLY the supplied records; do not make price targets, buy/sell instructions, return forecasts, or uncited market facts. Return strict JSON: {"stocks":[{"symbol":"string","stance":"Bullish|Neutral|Cautious","confidence":0,"thesis":"string","evidence_ids":["only supplied IDs"]}]}. Research: ${JSON.stringify(research.map(({ stock, agents }) => ({ symbol:stock.symbol, live_move_percent:stock.move, reported_earnings_date:stock.report?.date || null, agents })))}. Evidence: ${JSON.stringify(evidence)}.`;
  const defaults = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || defaults.slice(1).join(",")).split(",").map((item) => item.trim()).filter(Boolean);
  for (const model of [...new Set([process.env.GEMINI_MODEL || defaults[0], ...fallbacks])]) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method:"POST", headers:{ "content-type":"application/json", "x-goog-api-key":process.env.GEMINI_API_KEY }, body:JSON.stringify({ contents:[{ parts:[{ text:prompt }] }], generationConfig:{ maxOutputTokens:2048, responseMimeType:"application/json", thinkingConfig:{ thinkingLevel:"low" } } }) });
    if (!response.ok) continue;
    const payload = await response.json(); const parsed = parseJson(payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "");
    if (Array.isArray(parsed?.stocks)) return parsed.stocks;
  }
  return null;
}

export default {
  async fetch(request) {
    if (request.method !== "GET") return json({ error:"Method not allowed" }, 405);
    const snapshotResponse = await snapshotHandler.fetch(new Request("http://internal/api/snapshot"));
    const snapshot = await snapshotResponse.json();
    const research = buildResearch(snapshot);
    const evidence = Array.isArray(snapshot.evidence) ? snapshot.evidence : [];
    const allowed = new Set(evidence.map((item) => item.id));
    let synthesis = null;
    if (snapshot.mode === "live" && process.env.GEMINI_API_KEY) {
      try { synthesis = await aiSynthesis(research, evidence); } catch { synthesis = null; }
    }
    const final = synthesis || ruleSynthesis(research);
    const bySymbol = new Map(final.map((item) => [item.symbol, { ...item, evidence_ids:(item.evidence_ids || []).filter((id) => allowed.has(id)) }]));
    return json({ mode:snapshot.mode, asOf:snapshot.asOf, source:synthesis ? "AI synthesis" : "Evidence rules fallback", stocks:research.map(({ stock, agents }) => ({ symbol:stock.symbol, name:stock.name, move:stock.move, agents, final:bySymbol.get(stock.symbol) || ruleSynthesis([{ stock, agents }])[0] })) });
  }
};

