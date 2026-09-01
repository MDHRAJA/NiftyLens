function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ configured: false, message: "AI review needs GEMINI_API_KEY in the deployment environment." });
  const plan = req.body;
  const prompt = `You are an educational Indian retail-investment research assistant. Review this user-entered plan: ${JSON.stringify(plan)}. Do not make a buy/sell recommendation, guarantee returns, or provide individualized financial advice. Explain trade-offs, diversification, uncertainty, and questions the investor should ask. Return strict JSON: {"headline":"string","assessment":"string","better_approach":"string","risks":["string"],"questions":["string"]}.`;
  try {
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
    return res.status(200).json({ configured: true, review });
  } catch (error) {
    return res.status(502).json({ configured: true, error: error.message });
  }
}
