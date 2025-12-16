import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { telegramId } = req.query;

  const { data: top = [], error } = await supabase
    .from("players")
    .select("id, username, balance")
    .order("balance", { ascending: false })
    .limit(10);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  let position = null;

  if (telegramId) {
    const { data: all = [] } = await supabase
      .from("players")
      .select("id")
      .order("balance", { ascending: false });

    position = all.findIndex(p => p.id == telegramId) + 1 || null;
  }

  res.json({ top, position });
}
