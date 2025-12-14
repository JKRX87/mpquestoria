import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { telegramId, username } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  // Проверяем, есть ли пользователь
  const { data: user } = await supabase
    .from("players")
    .select("*")
    .eq("id", telegramId)
    .single();

  if (!user) {
    // создаём пользователя
    await supabase.from("players").insert({
      id: telegramId,
      username: username || "Player"
    });

    return res.status(200).json({
      balance: 0,
      username: username || "Player"
    });
  }

  res.status(200).json({
    balance: user.balance,
    username: user.username
  });
}
