import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const { telegramId } = req.query;

    const { data: top = [], error: topError } = await supabase
      .from("players")
      .select("id, username, balance")
      .order("balance", { ascending: false })
      .limit(10);

    if (topError) {
      return res.status(500).json({ error: topError.message });
    }

    let position = null;
    if (telegramId) {
      const { data: all = [] } = await supabase
        .from("players")
        .select("id")
        .order("balance", { ascending: false });

      const idx = all.findIndex(p => String(p.id) === String(telegramId));
      position = idx >= 0 ? idx + 1 : null;
    }

    res.json({ top, position });

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
}
