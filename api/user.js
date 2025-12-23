import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === "POST" && action === "profile") {
    const { telegramId, username, referrerId } = req.body;

    // 1. Проверяем пользователя
    let { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    // 2. Если нет — создаём
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

    // 3. АТОМАРНО: награда рефералу
    if (user.referrer_id) {
      const { data: rewardedUser } = await supabase
        .from("players")
        .update({
          balance: (user.balance ?? 0) + 200,
          referral_rewarded: true
        })
        .eq("id", telegramId)
        .eq("referral_rewarded", false)
        .select()
        .single();

      // 4. Если обновилась строка — начисляем пригласившему
      if (rewardedUser) {
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

        return res.json(rewardedUser);
      }
    }

    return res.json(user);
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
