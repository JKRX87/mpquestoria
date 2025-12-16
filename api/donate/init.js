import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { telegramId, amount } = req.body;

  if (!telegramId || !amount) {
    return res.status(400).json({ error: "Invalid data" });
  }

  // 1. Находим игрока
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (playerError || !player) {
    return res.status(404).json({ error: "Player not found" });
  }

  // 2. Создаём pending донат
  const { data, error } = await supabase
    .from("donations")
    .insert({
      player_id: player.id,
      amount_ton: amount,
      status: "pending"
    })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ donationId: data.id });
}
