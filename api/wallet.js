import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { telegramId, wallet } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  await supabase
    .from("players")
    .update({ wallet: wallet || null })
    .eq("id", telegramId);

  res.json({ success: true });
}
