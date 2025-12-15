import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { telegramId, username, referrerId } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  const { data: existingUser } = await supabase
    .from("players")
    .select("*")
    .eq("id", telegramId)
    .single();

  // если пользователь новый — создаём
  if (!existingUser) {
    await supabase.from("players").insert({
      id: telegramId,
      username: username || "Player",
      referrer_id:
        referrerId && Number(referrerId) !== telegramId
          ? referrerId
          : null
    });

    return res.json({
      balance: 0,
      username: username || "Player"
    });
  }

  // если уже существует — не перезаписываем referrer
  res.json({
    balance: existingUser.balance,
    username: existingUser.username
  });
}
