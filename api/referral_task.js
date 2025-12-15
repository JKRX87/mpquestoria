import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { telegramId } = req.query;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  // 1️⃣ получаем задание
  const { data: task, error: taskError } = await supabase
    .from("referral_tasks")
    .select("*")
    .single();

  if (taskError || !task) {
    return res.status(500).json({ error: "Task not found" });
  }

  // 2️⃣ считаем рефералов
  const { data: refs, error: refsError } = await supabase
    .from("players")
    .select("id")
    .eq("referrer_id", telegramId);

  if (refsError) {
    return res.status(500).json({ error: refsError.message });
  }

  // 3️⃣ проверяем, выполнено ли задание ранее
  const { data: completedTask } = await supabase
    .from("completed_referral_tasks")
    .select("id")
    .eq("player_id", telegramId)
    .eq("task_id", task.id)
    .maybeSingle();

  res.json({
    required: task.required,
    reward: task.reward,
    current: refs.length,
    completed: !!completedTask
  });
}
