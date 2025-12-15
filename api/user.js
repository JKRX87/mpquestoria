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

  // 👤 ЕСЛИ ПОЛЬЗОВАТЕЛЬ НОВЫЙ
  if (!existingUser) {
    const newPlayer = {
      id: telegramId,
      username: username || "Player",
      referrer_id:
        referrerId && Number(referrerId) !== telegramId
          ? referrerId
          : null
    };

    // создаём игрока
    await supabase.from("players").insert(newPlayer);

    // 🎁 НАГРАДА РЕФЕРЕРУ (ШАГ 35)
    if (newPlayer.referrer_id) {
      await supabase.rpc("increment_balance", {
        player_id: newPlayer.referrer_id,
        amount: 5
      });
    }

    return res.json({
      balance: 0,
      username: username || "Player"
    });
  }

  // 👤 ЕСЛИ ПОЛЬЗОВАТЕЛЬ УЖЕ СУЩЕСТВУЕТ
  res.json({
    balance: existingUser.balance,
