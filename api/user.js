import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  let telegramId, username, referrerId;

  if (req.method === "POST") {
    // POST → данные приходят в body
    ({ telegramId, username, referrerId } = req.body);
  } else if (req.method === "GET") {
    // GET → данные приходят в query
    telegramId = req.query.telegramId;
    username = req.query.username;
    referrerId = req.query.referrerId;
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  // ⚠️ безопасно парсим referrerId
  let parsedReferrerId = null;
  const refIdNumber = Number(referrerId);
  if (
    Number.isInteger(refIdNumber) &&
    refIdNumber > 0 &&
    refIdNumber !== Number(telegramId)
  ) {
    parsedReferrerId = refIdNumber;
  }

  // 🔍 ищем пользователя
  const { data: existingUser } = await supabase
    .from("players")
    .select("*")
    .eq("id", telegramId)
    .maybeSingle();

  if (!existingUser) {
    const newPlayer = {
      id: telegramId,
      username: username || "Player",
      referrer_id: parsedReferrerId
    };

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

  return res.json({
    balance: existingUser.balance,
    username: existingUser.username
  });
}
