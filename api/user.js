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

    const { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    // =====================
    // ЕСЛИ ПОЛЬЗОВАТЕЛЬ ЕСТЬ
    // =====================
    if (user) {
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
      }

      const { data: updatedUser } = await supabase
        .from("players")
        .select("*")
        .eq("id", telegramId)
        .single();

      return res.json(updatedUser);
    }

    // =====================
    // ЕСЛИ ПОЛЬЗОВАТЕЛЯ НЕТ
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

  // =====================
  // UNKNOWN ACTION
  // =====================
  return res.status(400).json({ error: "Unknown user action" });
}
