import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { telegramId, wallet } = req.body;
  if (!telegramId || !wallet) {
    return res.status(400).json({ error: "Missing data" });
  }

  await supabase.from("players")
    .update({ wallet })
    .eq("id", telegramId);

  res.json({ success: true });
}
