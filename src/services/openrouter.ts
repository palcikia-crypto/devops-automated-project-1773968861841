export async function generateOpenRouterResponse(messages: any[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key is missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "DevOps AI Assistant",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/gemini-pro-1.5", // Default model for OpenRouter
      messages: messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: typeof m.contents === 'string' ? m.contents : JSON.stringify(m.contents)
      }))
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenRouter Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    candidates: [{ content: { parts: [{ text: data.choices[0].message.content }] } }]
  };
}
