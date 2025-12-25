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

  // 1️⃣ ищем активную сессию этого типа
  const { data: activeSession } = await supabase
    .from("game_sessions")
    .select(`
      id,
      scenario_id,
      game_scenarios ( game_number, type )
    `)
    .eq("player_id", telegramId)
    .eq("is_finished", false)
    .eq("game_scenarios.type", type)
    .maybeSingle();

  // считаем общее количество игр
  const { count: total } = await supabase
    .from("game_scenarios")
    .select("*", { count: "exact", head: true })
    .eq("type", type);

  if (activeSession) {
    return res.json({
      resume: true,
      sessionId: activeSession.id,
      scenarioId: activeSession.scenario_id,
      gameNumber: activeSession.game_scenarios.game_number,
      total
    });
  }

  // 2️⃣ исключаем выигранные
  const { data: finished } = await supabase
    .from("game_sessions")
    .select("scenario_id")
    .eq("player_id", telegramId)
    .eq("result", "win");

  const excludedIds = finished?.map(s => s.scenario_id) ?? [];

  let query = supabase
    .from("game_scenarios")
    .select("id, game_number")
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

  return res.json({
    resume: false,
    scenarioId: random.id,
    gameNumber: random.game_number,
    total
  });
}
