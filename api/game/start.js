import { createClient } from "@supabase/supabase-js";
import { openai } from "../../lib/openai";
import { GAME_CONFIG } from "../../lib/gameConfig";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { telegramId, mode, type, theme, goal, details } = req.body;

  if (!telegramId || !mode || !type) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const cfg = GAME_CONFIG[mode]?.[type];
  if (!cfg) {
    return res.status(400).json({ error: "Invalid game config" });
  }

  const prompt =
    type === "custom"
      ? `
Создай УНИКАЛЬНЫЙ сюжет интерактивной игры.
Тематика: ${theme}
Цель: ${goal}
Дополнительные вводные: ${details}

Формат:
1. Описание ситуации
2. Роль пользователя
3. Итоговая цель

Заверши фразой:
"Когда будешь готов — нажми НАЧАТЬ"
`
      : `
Создай УНИКАЛЬНЫЙ сюжет интерактивной игры.

Формат:
1. Описание ситуации
2. Роль пользователя
3. Итоговая цель

Заверши фразой:
"Когда будешь готов — нажми НАЧАТЬ"
`;

  const ai = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "Ты игровой мастер. Придумывай уникальные, мрачные, морально сложные сюжеты. Никогда не повторяйся."
      },
      { role: "user", content: prompt }
    ]
  });

  const intro = ai.choices[0].message.content;

  const { data: session } = await supabase
    .from("game_sessions")
    .insert({
      player_id: telegramId,
      mode,
      type,
      goal: goal || "Достичь поставленной цели",
      max_steps: cfg.steps,
      points_reward: cfg.points
    })
    .select()
    .single();

  await supabase.from("game_steps").insert({
    session_id: session.id,
    step_number: 0,
    story: intro,
    choices: []
  });

  res.json({
    sessionId: session.id,
    intro,
    goal: session.goal
  });
}
