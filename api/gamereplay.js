import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { sessionId, telegramId } = req.query;

  // проверяем игрока
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (!player) return res.status(403).json({ error: "Forbidden" });

  // проверяем сессию
  const { data: session } = await supabase
    .from("game_sessions")
    .select(`
      id,
      result,
      scenario:game_scenarios(title)
    `)
    .eq("id", sessionId)
    .eq("player_id", player.id)
    .eq("result", "win")
    .single();

  if (!session) {
    return res.status(404).json({ error: "Replay not found" });
  }

  // шаги
  const { data: steps } = await supabase
    .from("game_session_steps")
    .select(`
      step_key,
      choice:game_choices(choice_text),
      step:game_steps(story)
    `)
    .eq("session_id", sessionId)
    .order("created_at");

  return res.json({
    title: session.scenario.title,
    steps
  });
}
