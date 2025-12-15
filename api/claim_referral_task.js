import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { telegramId } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  // 1️⃣ получаем задание
  const { data: task } = await supabase
    .from("referral_tasks")
    .select("*")
    .single();

  // 2️⃣ проверяем, выполнено ли уже
  const { data: completed } = await supabase
    .from("completed_referral_tasks")
    .select("*")
    .eq("player_id", telegramId)
    .eq("task_id", task.id)
    .maybeSingle();

  if (completed) {
    return res.status(400).json({ error: "Task already completed" });
  }

  // 3️⃣ считаем рефералов
  const { data: refs } = await supabase
    .from("players")
    .select("id")
    .eq("referrer_id", telegramId);

  if (refs.length < task.required) {
    return res.status(400).json({ error: "Task not completed yet" });
  }

  // 4️⃣ начисляем награду
  await supabase.rpc("increment_balance", {
    player_id: telegramId,
    amount: task.reward
  });

  // 5️⃣ отмечаем задание выполненным
  await supabase.from("completed_referral_tasks").insert({
    player_id: telegramId,
    task_id: task.id
  });

  res.json({
    success: true,
    reward: task.reward
  });
}
