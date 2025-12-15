import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { telegramId, amount } = req.body;
  if (!telegramId || !amount) {
    return res.status(400).json({ error: "Missing data" });
  }

  const reward = amount * 100;

  await supabase.rpc("increment_balance", {
    player_id: telegramId,
    amount: reward
  });

  res.json({ success: true, reward });
}
