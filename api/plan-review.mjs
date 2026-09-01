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
      const plan = await request.json();
      const prompt = `You are an educational Indian retail-investment research assistant. Review this user-entered plan: ${JSON.stringify(plan)}. Do not make a buy/sell recommendation, guarantee returns, or provide individualized financial advice. Explain trade-offs, diversification, uncertainty, and questions the investor should ask. Return strict JSON: {"headline":"string","assessment":"string","better_approach":"string","risks":["string"],"questions":["string"]}.`;
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
      return json({ configured: true, review });
    } catch (error) {
      return json({ configured: true, error: error.message }, 502);
    }
  }
};
