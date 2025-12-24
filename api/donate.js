import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // =====================
  // INIT DONATION (pending)
  // =====================
if (action === "init") {
  const { telegramId, amount, type } = req.body;
  const playerId = Number(telegramId);

  if (!playerId || !amount) {
    return res.status(400).json({ error: "Invalid data" });
  }

  // 🧹 1. Чистим старые pending (>15 минут)
  await supabase
    .from("donations")
    .delete()
    .eq("status", "pending")
    .lt(
      "created_at",
      new Date(Date.now() - 15 * 60 * 1000).toISOString()
    );

  // 2. Проверяем игрока
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .single();

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  // 3. Проверяем активный pending
  const { data: existingPending } = await supabase
    .from("donations")
    .select("id")
    .eq("player_id", playerId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return res.json({ donationId: existingPending.id });
  }

  // 4. Создаём новый pending
  const { data, error } = await supabase
    .from("donations")
    .insert({
      player_id: playerId,
      amount_ton: amount,
      type: type || "support",
      status: "pending"
    })
    .select()
    .single();

  if (error) {
    console.error("DONATE INIT ERROR:", error);
    return res.status(400).json({ error: error.message });
  }

  return res.json({ donationId: data.id });
}

  // =====================
  // CONFIRM DONATION
  // =====================
  if (action === "confirm") {
    const { donationId, txHash } = req.body;

    if (!donationId || !txHash) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const { data, error } = await supabase
      .from("donations")
      .update({
        tx_hash: txHash,
        status: "confirmed"
      })
      .eq("id", donationId)
      .eq("status", "pending")
      .select()
      .single();

    if (error || !data) {
      return res.status(400).json({ error: error?.message || "Not updated" });
    }

    await supabase.rpc("increment_balance", {
      player_id: data.player_id,
      amount: Math.floor(data.amount_ton * 100)
    });

    return res.json({ success: true });
  }

  // =====================
  // DIRECT DONATE (fallback)
  // =====================
  if (action === "direct") {
    const { telegramId, amount, txHash } = req.body;
    const playerId = Number(telegramId);

    if (!playerId || !amount) {
      return res.status(400).json({ error: "Invalid data" });
    }

    await supabase.from("donations").insert({
      player_id: playerId,
      amount_ton: amount,
      tx_hash: txHash || null,
      status: "confirmed"
    });

    await supabase.rpc("increment_balance", {
      player_id: playerId,
      amount: Math.floor(amount * 100)
    });

    return res.json({ success: true });
  }

  return res.status(400).json({ error: "Unknown donate action" });
}
