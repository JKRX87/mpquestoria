import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { telegramId, gameType = "simple", version = "base" } = req.body;

  if (!telegramId) return res.status(400).json({ error: "No telegramId" });

  // Создаём сессию
  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      player_id: telegramId,
      game_type: gameType,
      version: version
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Первый шаг игры
  const firstStep = {
    text: "Ты попал в первый уровень Простой игры. Выбери действие:",
    options: [
      { id: 1, text: "Идти вперёд" },
      { id: 2, text: "Оглядеться вокруг" }
    ]
  };

  res.status(200).json({
    sessionId: data.id,
    step: data.step,
    firstStep
  });
}
