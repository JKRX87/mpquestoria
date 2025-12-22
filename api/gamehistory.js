import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { telegramId } = req.query;

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (!player) {
    return res.json({ games: [] });
  }

  const { data: games } = await supabase
    .from("game_sessions")
    .select(`
      id,
      scenario_id,
      created_at,
      scenario:game_scenarios(
        title,
        type,
        game_number
      )
    `)
    .eq("player_id", player.id)
    .eq("result", "win")
    .order("created_at", { ascending: false });

  if (!games || games.length === 0) {
    return res.json({ games: [] });
  }

  const unique = new Map();

  games.forEach(g => {
    if (!unique.has(g.scenario_id)) {
      unique.set(g.scenario_id, g);
    }
  });

  return res.json({
    games: Array.from(unique.values())
  });
}
