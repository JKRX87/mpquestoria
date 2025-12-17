const HF_API_KEY = process.env.OPENAI_API_KEY;

// ⚠️ Модель можно сменить в одном месте
const HF_MODEL =
  "mistralai/Mixtral-8x7B-Instruct-v0.1";
// альтернативы:
// "meta-llama/Llama-3.1-8B-Instruct"
// "HuggingFaceH4/zephyr-7b-beta"

export async function generateAIResponse(prompt) {
  const res = await fetch(
    `https://api-inference.huggingface.co/models/${HF_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: 0.9,
          max_new_tokens: 800,
          return_full_text: false
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("HF API error: " + err);
  }

  const data = await res.json();

  return data?.[0]?.generated_text || "";
}
