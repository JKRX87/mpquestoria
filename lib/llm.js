// lib/llm.js

export async function generateText(prompt, options = {}) {
  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/google/gemma-2b-it",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: options.temperature ?? 1.0,
          max_new_tokens: options.maxTokens ?? 600,
          return_full_text: false
        }
      })
    }
  );

  const rawText = await response.text();

  if (!response.ok) {
    console.error("HF RAW ERROR:", rawText);
    throw new Error("HF error: " + rawText);
  }

  const data = JSON.parse(rawText);

  // HF иногда возвращает разные форматы
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  }

  if (typeof data === "object" && data.generated_text) {
    return data.generated_text;
  }

  throw new Error("Unexpected HF response format");
}
