import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  console.log("➡️ USER API CALLED", {
    method: req.method,
    action,
    body: req.body
  });

  // =====================
  // CREATE / LOAD USER
  // =====================
  if (req.method === "POST" && action === "profile") {
    const { telegramId, username, referrerId } = req.body;

    console.log("🔍 PROFILE REQUEST", {
      telegramId,
      username,
      referrerId
    });

    // 1. Проверяем, есть ли пользователь
    const { data: existingUser, error: findError } = await supabase
      .from("players")
      .select("*")
      .eq("id", telegramId)
      .single();

    console.log("👤 EXISTING USER RESULT", {
      existingUser,
      findError
    });

    // === если пользователь уже есть — ничего не начисляем
    if (existingUser) {
      console.log("✅ USER EXISTS — RETURNING WITHOUT REWARD");
      return res.json(existingUser);
    }

    // 2. Проверяем, валиден ли реферал
    const isReferral =
      !!referrerId &&
      Number(referrerId) !== Number(telegramId);

    console.log("🤝 REFERRAL CHECK", {
      isReferral,
      referrerId,
      telegramId
    });

    // 3. Создаём нового пользователя
    const { data: newUser, error: createError } = await supabase
      .from("players")
      .insert({
        id: telegramId,
        username,
        referrer_id: isReferral ? referrerId : null,
        balance: isReferral ? 200 : 0,
        referral_rewarded: isReferral
      })
      .select()
      .single();

    console.log("🆕 NEW USER CREATED", {
      newUser,
      createError
    });

    if (createError) {
      console.error("❌ USER CREATE ERROR", createError);
      return res.status(500).json({ error: createError.message });
    }

    // 4. Начисляем +500 пригласившему
    if (isReferral) {
      console.log("💰 ADDING REWARD TO REFERRER", referrerId);

      const { data: referrer, error: refFindError } = await supabase
        .from("players")
        .select("id, balance")
        .eq("id", referrerId)
        .single();

      console.log("👥 REFERRER FOUND", {
        referrer,
        refFindError
      });

      if (referrer) {
        const { error: updateError } = await supabase
          .from("players")
          .update({
            balance: (referrer.balance ?? 0) + 500
          })
          .eq("id", referrerId);

        console.log("✅ REFERRER BALANCE UPDATE RESULT", {
          updateError
        });
      } else {
        console.warn("⚠️ REFERRER NOT FOUND — NO UPDATE");
      }
    }

    console.log("🎉 PROFILE FLOW FINISHED");
    return res.json(newUser);
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
