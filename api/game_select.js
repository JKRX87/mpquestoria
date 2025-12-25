import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { telegramId, type } = req.body;

    if (!telegramId || !type) {
      return res.status(400).json({ error: "Invalid data" });
    }

    // =========================
    // 1. Получаем игрока
    // =========================
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerId = player.id;

    // =========================
    // 2. Общее количество игр этого типа
    // =========================
    const { count: total } = await supabase
      .from("game_scenarios")
      .select("*", { count: "exact", head: true })
      .eq("type", type);

    // =========================
    // 3. Ищем активную сессию
    // =========================
    const { data: activeSession } = await supabase
      .from("game_sessions")
      .select(`
        id,
        scenario_id,
        game_scenarios ( game_number, type )
      `)
      .eq("player_id", playerId)
      .eq("is_finished", false)
      .eq("game_scenarios.type", type)
      .maybeSingle();

    // защита от битой сессии
    if (activeSession && !activeSession.game_scenarios) {
      await supabase
        .from("game_sessions")
        .update({ is_finished: true })
        .eq("id", activeSession.id);
    } else if (activeSession) {
      return res.json({
        resume: true,
        sessionId: activeSession.id,
        scenarioId: activeSession.scenario_id,
        gameNumber: activeSession.game_scenarios.game_number,
        total
      });
    }

    // =========================
    // 4. Исключаем выигранные сценарии
    // =========================
    const { data: finished } = await supabase
      .from("game_sessions")
      .select("scenario_id")
      .eq("player_id", playerId)
      .eq("result", "win");

    const excludedIds = finished?.map(s => s.scenario_id) ?? [];

    // =========================
    // 5. Выбираем случайный сценарий
    // =========================
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
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
