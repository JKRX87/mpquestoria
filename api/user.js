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

  // ⚠️ ВАЖНО: безопасно парсим referrerId
  let parsedReferrerId = null;
  const refIdNumber = Number(referrerId);

  if (
    Number.isInteger(refIdNumber) &&
    refIdNumber > 0 &&
    refIdNumber !== telegramId
  ) {
    parsedReferrerId = refIdNumber;
  }

  // 🔍 ищем пользователя
  const { data: existingUser } = await supabase
    .from("players")
    .select("*")
    .eq("id", telegramId)
    .maybeSingle(); // 👈 ВАЖНО: не single()

  // 👤 ЕСЛИ НОВЫЙ ПОЛЬЗОВАТЕЛЬ
  if (!existingUser) {
    const newPlayer = {
      id: telegramId,
      username: username || "Player",
      referrer_id: parsedReferrerId
    };

    // создаём игрока
    const { error } = await supabase.from("players").insert(newPlayer);

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    // 🎁 награда рефереру
    if (parsedReferrerId) {
      await supabase.rpc("increment_balance", {
        player_id: parsedReferrerId,
        amount: 5
      });
    }

    return res.json({
      balance: 0,
      username: username || "Player"
    });
  }

  // 👤 ЕСЛИ УЖЕ СУЩЕСТВУЕТ
  return res.json({
    balance: existingUser.balance,
    username: existingUser.username
  });
}
