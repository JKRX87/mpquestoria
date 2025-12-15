import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { telegramId, amount, txHash } = req.body;

  if (!telegramId || !amount) {
    return res.status(400).json({ error: "Invalid data" });
  }

  await supabase.from("donations").insert({
    player_id: telegramId,
    amount_ton: amount,
    tx_hash: txHash || null
  });

  // 🎁 начисляем очки (пример: 1 TON = 100 очков)
  await supabase.rpc("increment_balance", {
    player_id: telegramId,
    amount: Math.floor(amount * 100)
  });

  res.json({ success: true });
}
