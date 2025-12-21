import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ВАЖНО: service role
);

export default async function handler(req, res) {
  try {
    const { action } = req.query;
    const body = req.method === "POST" ? req.body : {};

    const telegramId = Number(body.telegramId);
    if (!telegramId) {
      return res.status(400).json({ error: "telegramId required" });
    }

    // ===== получаем игрока =====
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerId = player.id;

    // =====================================================
    // START GAME
    // =====================================================
    if (action === "start") {
      const { scenarioCode } = body;

      const { data: scenario } = await supabase
        .from("game_scenarios")
        .select("*")
        .eq("code", scenarioCode)
        .single();

      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      // закрываем старые сессии
      await supabase
        .from("game_sessions")
        .update({ is_finished: true })
        .eq("player_id", playerId)
        .eq("is_finished", false);

      // стартовый шаг
      const { data: startStep } = await supabase
        .from("game_steps")
        .select("*")
        .eq("scenario_id", scenario.id)
        .eq("step_key", "start")
        .single();

      if (!startStep) {
        return res.status(500).json({ error: "Start step not found" });
      }

      // создаём сессию
      const { data: session } = await supabase
        .from("game_sessions")
        .insert({
          player_id: playerId,
          scenario_id: scenario.id,
          current_step: 1,
          is_finished: false
        })
        .select()
        .single();

      // варианты
      const { data: choices } = await supabase
        .from("game_choices")
        .select("id, choice_text, next_step_key")
        .eq("step_id", startStep.id);

      return res.json({
        sessionId: session.id,
        story: startStep.story,
        choices
      });
    }
    
// =====================================================
// RESUME GAME
// =====================================================
if (action === "resume") {
  const { sessionId } = body;

  const { data: session } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("player_id", playerId)
    .eq("is_finished", false)
    .single();

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // шаг по current_step
  const { data: step } = await supabase
    .from("game_steps")
    .select("*")
    .eq("scenario_id", session.scenario_id)
    .order("created_at")
    .limit(1)
    .offset(session.current_step - 1)
    .single();

  if (!step) {
    return res.status(404).json({ error: "Step not found" });
  }

  const { data: choices } = await supabase
    .from("game_choices")
    .select("id, choice_text, next_step_key")
    .eq("step_id", step.id);

  return res.json({
    sessionId: session.id,
    story: step.story,
    choices
  });
}

    // =====================================================
    // MAKE CHOICE
    // =====================================================
    if (action === "choice") {
      const { sessionId, choiceId } = body;

      const { data: session } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("player_id", playerId)
        .single();

      if (!session || session.is_finished) {
        return res.status(400).json({ error: "Session invalid" });
      }

      const { data: choice } = await supabase
        .from("game_choices")
        .select("*")
        .eq("id", choiceId)
        .single();

      if (!choice) {
        return res.status(404).json({ error: "Choice not found" });
      }

      const { data: nextStep } = await supabase
        .from("game_steps")
        .select("*")
        .eq("scenario_id", session.scenario_id)
        .eq("step_key", choice.next_step_key)
        .single();

      if (!nextStep) {
        return res.status(404).json({ error: "Next step not found" });
      }

      // обновляем сессию
      await supabase
        .from("game_sessions")
        .update({
          current_step: session.current_step + 1,
          is_finished: nextStep.is_end
        })
        .eq("id", sessionId);

      if (nextStep.is_end) {
        return res.json({
          story: nextStep.story,
          choices: [],
          isEnd: true
        });
      }

      const { data: choices } = await supabase
        .from("game_choices")
        .select("id, choice_text, next_step_key")
        .eq("step_id", nextStep.id);

      return res.json({
        story: nextStep.story,
        choices,
        isEnd: false
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
