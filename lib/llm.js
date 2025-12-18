export async function generateText(prompt, options = {}) {
  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/HuggingFaceH4/zephyr-7b-beta",
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

  if (!Array.isArray(data) || !data[0]?.generated_text) {
    throw new Error("HF invalid response: " + JSON.stringify(data));
  }

  return data[0].generated_text;
}
