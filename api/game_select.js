import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { telegramId, type } = req.body;

  if (!telegramId || !type) {
    return res.status(400).json({ error: "Invalid data" });
  }

  // 1. игры, которые пользователь уже ВЫИГРАЛ
  const { data: finished } = await supabase
    .from("game_sessions")
    .select("scenario_id")
    .eq("player_id", telegramId)
    .eq("result", "win");

  const excludedIds = finished?.map(s => s.scenario_id) ?? [];

  // 2. выбираем случайную игру нужного типа
  let query = supabase
    .from("game_scenarios")
    .select("id, code, game_number")
    .eq("type", type);

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

  const { data: scenarios } = await query;

  if (!scenarios || scenarios.length === 0) {
    return res.json({ done: true });
  }

  const random =
    scenarios[Math.floor(Math.random() * scenarios.length)];

  // 3. считаем общее количество игр
  const { count } = await supabase
    .from("game_scenarios")
    .select("*", { count: "exact", head: true })
    .eq("type", type);

  return res.json({
    scenarioId: random.id,
    gameNumber: random.game_number,
    total: count
  });
}
