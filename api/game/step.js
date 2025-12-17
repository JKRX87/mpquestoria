import { createClient } from "@supabase/supabase-js";
import { openai } from "../../lib/openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { sessionId, choice } = req.body;

  const { data: session } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session || session.status !== "active") {
    return res.status(400).json({ error: "Game not active" });
  }

  const { data: steps } = await supabase
    .from("game_steps")
    .select("*")
    .eq("session_id", sessionId)
    .order("step_number");

  const history = steps
    .map(s => s.story)
    .join("\n");

  const isFinal = session.current_step + 1 >= session.max_steps;

  const ai = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "Ты продолжаешь уникальную интерактивную историю. Не повторяйся."
      },
      {
        role: "user",
        content: `
Контекст:
${history}

Цель игрока: ${session.goal}
Шаг ${session.current_step + 1} из ${session.max_steps}

${isFinal ? "ЗАВЕРШИ ИСТОРИЮ" : "Продолжай"}

Формат:
STORY:
...
CHOICES:
1. ...
2. ...
3. ...
`
      }
    ]
  });

  const text = ai.choices[0].message.content;
  const [storyPart, choicesPart] = text.split("CHOICES:");

  const choices = isFinal
    ? []
    : choicesPart
        .trim()
        .split("\n")
        .map((t, i) => ({ id: i + 1, text: t.replace(/^\d+\.\s*/, "") }));

  await supabase.from("game_steps").insert({
    session_id: sessionId,
    step_number: session.current_step + 1,
    story: storyPart.replace("STORY:", "").trim(),
    choices,
    user_choice: choice
  });

  if (isFinal) {
    const win = storyPart.toLowerCase().includes("цель достигнута");

    await supabase
      .from("game_sessions")
      .update({
        status: win ? "win" : "alternative",
        finished_at: new Date()
      })
      .eq("id", sessionId);

    if (win) {
      await supabase.rpc("add_points", {
        p_telegram_id: session.player_id,
        p_points: session.points_reward
      });
    }
  }

  res.json({
    story: storyPart.replace("STORY:", "").trim(),
    choices,
    finished: isFinal
  });
}
