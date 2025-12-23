import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === "POST" && action === "profile") {
    const { telegramId, username, referrerId } = req.body;

    // 1. Загружаем пользователя
    let { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    // 2. Если пользователя нет — создаём
    if (!user) {
      const isReferral =
        referrerId &&
        Number(referrerId) !== Number(telegramId);

      const { data: newUser, error } = await supabase
        .from("players")
        .insert({
          id: telegramId,
          username,
          referrer_id: isReferral ? referrerId : null,
          balance: 0,
          referral_rewarded: false
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      user = newUser;
    }

    // 3. НАЧИСЛЯЕМ РЕФЕРАЛЬНУЮ НАГРАДУ (ОДИН РАЗ)
    if (user.referrer_id && user.referral_rewarded === false) {
      // +200 приглашённому
      await supabase
        .from("players")
        .update({
          balance: (user.balance ?? 0) + 200,
          referral_rewarded: true
        })
        .eq("id", telegramId);

      // +500 пригласившему
      const { data: referrer } = await supabase
        .from("players")
        .select("balance")
        .eq("id", user.referrer_id)
        .single();

      if (referrer) {
        await supabase
          .from("players")
          .update({
            balance: (referrer.balance ?? 0) + 500
          })
          .eq("id", user.referrer_id);
      }

      // обновляем user
      const { data: updated } = await supabase
        .from("players")
        .select("*")
        .eq("id", telegramId)
        .single();

      return res.json(updated);
    }

    // 4. Просто возвращаем пользователя
    return res.json(user);
  }

  // =====================
  // WALLET (оставляем)
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
