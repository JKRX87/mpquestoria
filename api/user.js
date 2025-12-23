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

    // 1. Проверяем пользователя
    const { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    // =====================
    // ЕСЛИ ПОЛЬЗОВАТЕЛЬ УЖЕ ЕСТЬ
    // =====================
    if (user) {

      // ===== REFERRAL REWARD LOGIC =====
      if (user.referrer_id && user.referral_rewarded === false) {

        // 1. Помечаем, что награда получена + даём +200
        await supabase
          .from("players")
          .update({
            balance: (user.balance ?? 0) + 200,
            referral_rewarded: true
          })
          .eq("id", telegramId);

        // 2. Получаем текущий баланс пригласившего
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
      }

      const { data: updatedUser } = await supabase
        .from("players")
        .select("*")
        .eq("id", telegramId)
        .single();

      return res.json(updatedUser);
    }

    // =====================
    // ЕСЛИ ПОЛЬЗОВАТЕЛЯ НЕТ (fallback)
    // =====================
    const { data: newUser, error } = await supabase
      .from("players")
      .insert({
        id: telegramId,
        username,
        balance: 0,
        referral_rewarded: false
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(newUser);
  }

  res.status(400).json({ error: "Unknown user action" });
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
