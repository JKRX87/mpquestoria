import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { telegramId } = req.query;

  const { data: task } = await supabase
    .from("referral_tasks")
    .select("*")
    .single();

  if (!task) {
    return res.json({
      required: 0,
      reward: 0,
      current: 0,
      completed: false
    });
  }

  const { data: refs = [] } = await supabase
    .from("players")
    .select("id")
    .eq("referrer_id", telegramId);

  const completed = refs.length >= task.required;

  res.json({
    required: task.required,
    reward: task.reward,
    current: refs.length,
    completed
  });
}
