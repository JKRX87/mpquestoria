import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { telegramId } = req.query;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, username, created_at")
    .eq("referrer_id", telegramId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    count: data.length,
    referrals: data
  });
}
