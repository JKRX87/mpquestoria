import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { action, telegramId } = req.query;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  // ===== LIST =====
  if (action === "list") {
    const { data, error } = await supabase
      .from("players")
      .select("id, username")
      .eq("referrer_id", telegramId);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      count: data.length,
      referrals: data
    });
  }

  // ===== TASK =====
  if (action === "task") {
    const REQUIRED = 3;
    const REWARD = 100;

    const { data } = await supabase
      .from("players")
      .select("id")
      .eq("referrer_id", telegramId);

    return res.json({
      required: REQUIRED,
      current: data.length,
      reward: REWARD,
      completed: data.length >= REQUIRED
    });
  }

  res.status(400).json({ error: "Unknown referrals action" });
}
