import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { telegramId } = req.query;

  // топ-10 игроков
  const { data: top } = await supabase
    .from("players")
    .select("id, username, balance")
    .order("balance", { ascending: false })
    .limit(10);

  // все игроки для определения позиции
  const { data: all } = await supabase
    .from("players")
    .select("id")
    .order("balance", { ascending: false });

  let position = null;

  if (telegramId && all) {
    const index = all.findIndex(p => String(p.id) === String(telegramId));
    if (index !== -1) {
      position = index + 1;
    }
  }

  res.json({
    top,
    position
  });
}
