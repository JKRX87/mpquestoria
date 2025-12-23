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
    const { telegramId, username, referrerId } = req.body;

    // 1. Проверяем, есть ли пользователь
    const { data: existingUser } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    // =====================
    // ЕСЛИ УЖЕ ЕСТЬ — ПРОСТО ВОЗВРАЩАЕМ
    // =====================
    if (existingUser) {
      return res.json(existingUser);
    }

    // =====================
    // СОЗДАНИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ
    // =====================
    const isReferral =
      referrerId &&
      Number(referrerId) !== Number(telegramId);

    const { data: newUser, error } = await supabase
      .from("players")
      .insert({
        id: telegramId,
        username,
        referrer_id: isReferral ? referrerId : null,
        balance: isReferral ? 200 : 0,     // +200 приглашённому
        referral_rewarded: isReferral      // сразу помечаем
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // =====================
    // +500 ПРИГЛАСИВШЕМУ (ОДИН РАЗ)
    // =====================
    if (isReferral) {
      const { data: referrer } = await supabase
        .from("players")
        .select("balance")
        .eq("id", referrerId)
        .single();

      if (referrer) {
        await supabase
          .from("players")
          .update({
            balance: (referrer.balance ?? 0) + 500
          })
          .eq("id", referrerId);
      }
    }

    return res.json(newUser);
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

  return res.status(400).json({ error: "Unknown user action" });
}
