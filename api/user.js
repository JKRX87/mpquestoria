import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  // =====================
  // CREATE / LOAD USER
  // =====================
  if (req.method === "POST" && action === "profile") {
    const { telegramId, username } = req.body;

    // 1. Проверяем, есть ли пользователь
    const { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    // === ЕСЛИ УЖЕ ЕСТЬ — просто возвращаем
    if (user) {
      return res.json(user);
    }

    // 2. Создаём нового пользователя
    const { data: newUser, error: createError } = await supabase
      .from("players")
      .insert({
        id: telegramId,
        username,
        referrer_id:
          referrerId && referrerId !== telegramId
            ? referrerId
            : null,
        balance: 0,
        referral_rewarded: false
      })
      .select()
      .single();

    if (createError) {
      return res.status(500).json({ error: createError.message });
    }

    // =====================
    // REFERRAL REWARD LOGIC
    // =====================
    if (
      newUser.referrer_id &&
      newUser.referral_rewarded === false
    ) {
      // +200 приглашённому
      await supabase
        .from("players")
        .update({
          balance: newUser.balance + 200,
          referral_rewarded: true
        })
        .eq("id", telegramId);

      // +500 пригласившему
      await supabase.rpc("add_balance", {
        tg_id: newUser.referrer_id,
        amount: 500
      });
    }

    // возвращаем обновлённого пользователя
    const { data: finalUser } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    return res.json(finalUser);
  }

  // =====================
  // WALLET
  // =====================
  if (req.method === "POST" && action === "wallet") {
    const { telegramId, wallet } = req.body;

    const { error } = await supabase
      .from("players")
      .update({ wallet })
      .eq("id", telegramId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true });
  }

  res.status(400).json({ error: "Unknown user action" });
}
