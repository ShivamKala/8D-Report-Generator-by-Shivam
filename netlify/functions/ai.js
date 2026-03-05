exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "❌ API key not configured on server. Add GROQ_API_KEY in Netlify Environment Variables." }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) }; }

  const { systemPrompt, userPrompt } = body;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || res.statusText;
      const hint =
        res.status === 401 ? "❌ Invalid API key in server config" :
        res.status === 429 ? "❌ Rate limit hit — wait a moment and try again" :
        `❌ Groq API Error ${res.status}`;
      return { statusCode: res.status, body: JSON.stringify({ error: `${hint}: ${msg}` }) };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
