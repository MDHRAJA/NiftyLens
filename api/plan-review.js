function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ configured: false, message: "AI review needs OPENAI_API_KEY in the deployment environment." });
  const plan = req.body;
  const prompt = `You are an educational Indian retail-investment research assistant. Review this user-entered plan: ${JSON.stringify(plan)}. Do not make a buy/sell recommendation, guarantee returns, or provide individualized financial advice. Explain trade-offs, diversification, uncertainty, and questions the investor should ask. Return strict JSON: {"headline":"string","assessment":"string","better_approach":"string","risks":["string"],"questions":["string"]}.`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5", input: prompt, max_output_tokens: 700, store: false })
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
    const payload = await response.json();
    const text = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("") || "";
    const review = parseJson(text);
    if (!review) throw new Error("AI response was not valid structured output");
    return res.status(200).json({ configured: true, review });
  } catch (error) {
    return res.status(502).json({ configured: true, error: error.message });
  }
}
