import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  // ===== CREATE / LOAD USER =====
  if (req.method === "POST" && action === "profile") {
    const { telegramId, username, referrerId } = req.body;

    const { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (user) {
      return res.json(user);
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        telegram_id: telegramId,
        username,
        referrer_id: referrerId || null
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // ===== WALLET =====
  if (req.method === "POST" && action === "wallet") {
    const { telegramId, wallet } = req.body;

    const { error } = await supabase
      .from("players")
      .update({ wallet })
      .eq("telegram_id", telegramId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(400).json({ error: "Unknown user action" });
}
