export async function generateText(prompt, options = {}) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: options.temperature ?? 1.1,
          max_new_tokens: options.maxTokens ?? 800,
          return_full_text: false
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error("HF error: " + text);
  }

  const data = await response.json();
  return data[0]?.generated_text ?? "";
}
