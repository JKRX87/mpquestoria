export default async function handler(req, res) {
  const { telegramId } = req.query;

  const { data } = await supabase
    .from("game_sessions")
    .select("id, mode, type, status, points_reward, created_at")
    .eq("player_id", telegramId)
    .order("created_at", { ascending: false });

  res.json({ games: data });
}
//
