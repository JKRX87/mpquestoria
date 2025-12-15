import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// простая базовая игра
const GAME_STEPS = {
  0: {
    text: "Ты оказался у развилки в открытом космосе. Что будешь делать?",
    options: [
      { id: "forward", text: "Лететь вперёд" },
      { id: "scan", text: "Просканировать пространство" }
    ]
  },
  1: {
    text: "Ты приближаешься к цели. Последний выбор:",
    options: [
      { id: "attack", text: "Рискнуть и ускориться" },
      { id: "wait", text: "Подождать и стабилизироваться" }
    ]
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { sessionId, choice } = req.body;

  const { data: session } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session || session.status !== "in_progress") {
    return res.status(400).json({ error: "Invalid session" });
  }

  // шаг 0 → шаг 1
  if (session.step === 0) {
    await supabase
      .from("game_sessions")
      .update({ step: 1 })
      .eq("id", sessionId);

    return res.json({
      step: 1,
      ...GAME_STEPS[1]
    });
  }

  // шаг 1 → финал
  let status = "lost";
  let reward = 0;

  if (choice === "attack") {
    status = "won";
    reward = 10;
  }

  // обновляем сессию
  await supabase
    .from("game_sessions")
    .update({ status, score: reward })
    .eq("id", sessionId);

  // если победа — начисляем очки
  if (status === "won") {
    await supabase.rpc("increment_balance", {
      player_id: session.player_id,
      amount: reward
    });
  }

  res.json({
    status,
    reward
  });
}
