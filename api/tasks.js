import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { action } = req.query;
    const body = req.method === "POST" ? req.body : {};

    const telegramId = Number(body.telegramId);
    if (!telegramId) {
      return res.status(400).json({ error: "telegramId required" });
    }

    // =========================
    // PLAYER
    // =========================
    const { data: player } = await supabase
      .from("players")
      .select("id, balance, wallet")
      .eq("telegram_id", telegramId)
      .single();

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerId = player.id;

    // =====================================================
    // LIST TASKS
    // =====================================================
    if (action === "list") {
      // 1. все задания
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .order("reward", { ascending: true });

      // 2. player_tasks
      const { data: playerTasks } = await supabase
        .from("player_tasks")
        .select("*")
        .eq("player_id", playerId);

      const map = {};
      playerTasks?.forEach(pt => {
        map[pt.task_id] = pt;
      });

      // 3. авто-создание player_tasks
      for (const task of tasks) {
        if (!map[task.id]) {
          await supabase.from("player_tasks").insert({
            player_id: playerId,
            task_id: task.id
          });
        }
      }

      // 4. проверка прогресса
      const result = [];
      for (const task of tasks) {
        const pt = map[task.id] || {};
        const completed = await checkTask(task, playerId, player);

        if (completed && !pt.completed) {
          await supabase
            .from("player_tasks")
            .update({
              completed: true,
              completed_at: new Date()
            })
            .eq("player_id", playerId)
            .eq("task_id", task.id);

          pt.completed = true;
        }

        result.push({
          id: task.id,
          code: task.code,
          title: task.title,
          description: task.description,
          reward: task.reward,
          type: task.type,
          metadata: task.metadata,
          completed: !!pt.completed,
          claimed: !!pt.claimed
        });
      }

      return res.json({ tasks: result });
    }

    // =====================================================
    // CLAIM TASK
    // =====================================================
    if (action === "claim") {
      const { taskId } = body;

      const { data: pt } = await supabase
        .from("player_tasks")
        .select("*")
        .eq("player_id", playerId)
        .eq("task_id", taskId)
        .single();

      if (!pt || !pt.completed) {
        return res.status(400).json({ error: "Task not completed" });
      }

      if (pt.claimed) {
        return res.status(400).json({ error: "Already claimed" });
      }

      const { data: task } = await supabase
        .from("tasks")
        .select("reward")
        .eq("id", taskId)
        .single();

      await supabase
        .from("players")
        .update({ balance: player.balance + task.reward })
        .eq("id", playerId);

      await supabase
        .from("player_tasks")
        .update({
          claimed: true,
          claimed_at: new Date()
        })
        .eq("id", pt.id);

      return res.json({ success: true, reward: task.reward });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}

// =====================================================
// TASK CHECKER
// =====================================================
async function checkTask(task, playerId, player) {
  const code = task.code;

  // ---------- GAME TASKS ----------
  if (code === "gamer_basic" || code === "gamer_hard" || code === "gamer_realistic") {
    const type = task.metadata?.type;

    const { count: total } = await supabase
      .from("game_scenarios")
      .select("*", { count: "exact", head: true })
      .eq("type", type);

    const { count: wins } = await supabase
      .from("game_sessions")
      .select("*", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("result", "win")
      .eq("game_scenarios.type", type);

    return total > 0 && total === wins;
  }

  if (code === "gamer_all") {
    const { count: total } = await supabase
      .from("game_scenarios")
      .select("*", { count: "exact", head: true });

    const { count: wins } = await supabase
      .from("game_sessions")
      .select("*", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("result", "win");

    return total > 0 && total === wins;
  }

  // ---------- ACTIONS ----------
  if (code === "link_wallet") {
    return !!player.wallet;
  }

  if (code === "donate_unlock") {
    const { count } = await supabase
      .from("donations")
      .select("*", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("status", "confirmed");

    return count > 0;
  }

  // соцсети — вручную через кнопку
  return false;
}
