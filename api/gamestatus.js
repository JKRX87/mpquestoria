import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    switch (action) {
      case "active":
        return await getActiveGame(req, res);
      case "start":
        return await startGame(req, res);
      case "progress":
        return await saveProgress(req, res);
      case "finish":
        return await finishGame(req, res);
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    console.error("Game API error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}

/* ============================= */
/* ACTIVE GAME */
/* ============================= */
async function getActiveGame(req, res) {
  const { telegram_id, scenarioCode } = req.body;

  const { data, error } = await supabase
    .from("game_sessions")
    .select(`
      id,
      current_step,
      scenario:game_scenarios(code, title)
    `)
    .eq("player_id", playerId)
    .eq("is_finished", false)
    .eq("scenario.code", scenarioCode)
    .maybeSingle();

  if (error) throw error;

  return res.json({ session: data || null });
}

/* ============================= */
/* START GAME */
/* ============================= */
async function startGame(req, res) {
  const { telegram_id, scenarioCode, restart = false } = req.body;

  // если перезапуск — закрываем старую
  if (restart) {
    await supabase
      .from("game_sessions")
      .update({ is_finished: true })
      .eq("player_id", telegramid)
      .eq("is_finished", false);
  }

  const { data: scenario } = await supabase
    .from("game_scenarios")
    .select("id")
    .eq("code", scenarioCode)
    .single();

  if (!scenario) {
    return res.status(404).json({ error: "Scenario not found" });
  }

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      player_id: telegramid,
      scenario_id: scenario.id,
      current_step: 1
    })
    .select()
    .single();

  if (error) throw error;

  return res.json({ session: data });
}

/* ============================= */
/* SAVE PROGRESS */
/* ============================= */
async function saveProgress(req, res) {
  const { sessionId, nextStep } = req.body;

  const { error } = await supabase
    .from("game_sessions")
    .update({
      current_step: nextStep,
      updated_at: new Date()
    })
    .eq("id", sessionId)
    .eq("is_finished", false);

  if (error) throw error;

  return res.json({ ok: true });
}

/* ============================= */
/* FINISH GAME */
/* ============================= */
async function finishGame(req, res) {
  const { sessionId, result } = req.body;
  // result: "win" | "fail"

  const { error } = await supabase
    .from("game_sessions")
    .update({
      is_finished: true,
      updated_at: new Date()
    })
    .eq("id", sessionId);

  if (error) throw error;

  return res.json({ finished: true, result });
}
