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

  if (!player) return res.json({ games: [] });

  const { data: games } = await supabase
    .from("game_sessions")
    .select(`
      id,
      created_at,
      scenario:game_scenarios(title)
    `)
    .eq("player_id", player.id)
    .eq("result", "win")
    .order("created_at", { ascending: false });

  return res.json({ games });
}
