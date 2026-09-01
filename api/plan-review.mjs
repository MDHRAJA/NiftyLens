function json(body, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!process.env.GEMINI_API_KEY) return json({ configured: false, message: "AI review needs GEMINI_API_KEY in the deployment environment." }, 503);
    try {
      const { plan, marketContext } = await request.json();
      const evidence = Array.isArray(marketContext?.evidence) ? marketContext.evidence : [];
      const validEvidence = evidence.filter((item) => item.id && item.claim && item.url && item.asOf && /^https:\/\//.test(item.url));
      if (marketContext?.mode !== "live" || validEvidence.length === 0) {
        return json({ configured: true, grounded: false, message: "No verified, fresh market evidence is available. NiftyLens will not produce an AI market recommendation." }, 422);
      }
      const evidenceIds = validEvidence.map((item) => item.id);
      const prompt = `You are an educational Indian retail-investment research assistant. Review the user plan and ONLY the evidence below. Never use outside knowledge. Do not make a buy/sell recommendation, guarantee returns, or provide individualized financial advice. Explain trade-offs, diversification and uncertainty. Every factual market claim must cite one or more supplied evidence IDs. If evidence is insufficient, say so. User plan: ${JSON.stringify(plan)}. Evidence: ${JSON.stringify(validEvidence)}. Return strict JSON: {"headline":"string","assessment":"string","better_approach":"string","risks":["string"],"questions":["string"],"evidence_ids":["one or more IDs from: ${evidenceIds.join(", ")}"]}.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-3.5-flash"}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 700, responseMimeType: "application/json" } })
      });
      if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
      const payload = await response.json();
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      const review = parseJson(text);
      if (!review) throw new Error("AI response was not valid structured output");
      review.evidence_ids = (review.evidence_ids || []).filter((id) => evidenceIds.includes(id));
      if (!review.evidence_ids.length) return json({ configured: true, grounded: false, message: "The AI response did not cite verified evidence, so it was withheld." }, 422);
      return json({ configured: true, grounded: true, review, evidence: validEvidence.filter((item) => review.evidence_ids.includes(item.id)) });
    } catch (error) {
      return json({ configured: true, error: error.message }, 502);
    }
  }
};
