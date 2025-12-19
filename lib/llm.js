// lib/llm.js
// DeepSeek API (OpenAI-compatible)

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function generateText(prompt, options = {}) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a creative interactive story generator."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: options.temperature ?? 0.9,
      max_tokens: options.maxTokens ?? 700
    })
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error("DEEPSEEK RAW ERROR:", raw);
    throw new Error("DeepSeek error: " + raw);
  }

  const data = JSON.parse(raw);

  return data.choices?.[0]?.message?.content ?? "";
}
