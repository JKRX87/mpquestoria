import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { action } = req.query;
    const body = req.method === "POST" ? req.body : req.query;

    const telegramId = Number(body.telegramId);
    if (!telegramId) {
      return res.status(400).json({ error: "telegramId required" });
    }

    // =====================================================
    // PLAYER
    // =====================================================
    const { data: player } = await supabase
      .from("players")
      .select("id, wallet")
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
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: true });

      const { data: completed } = await supabase
        .from("completed_tasks")
        .select("task_id")
        .eq("player_id", playerId);

      const completedSet = new Set(
        (completed ?? []).map(t => t.task_id)
      );

      const result = [];

      for (const task of tasks) {
        let progress = 0;
        let required = task.metadata?.required ?? 1;
        let canClaim = false;

        // =========================
        // REFERRAL
        // =========================
        if (task.type === "referral") {
          const { data: refs } = await supabase
            .from("players")
            .select("id")
            .eq("referrer_id", telegramId);

          progress = refs.length;
          canClaim = progress >= required;
        }

        // =========================
        // GAME PROGRESS
        // =========================
        if (task.type === "progress" && task.metadata?.gameType) {
          const { count } = await supabase
            .from("game_sessions")
            .select("*", { count: "exact", head: true })
            .eq("player_id", playerId)
            .eq("result", "win")
            .eq("game_scenarios.type", task.metadata.gameType);

          progress = count;
          canClaim = progress >= required;
        }

        // =========================
        // WALLET
        // =========================
        if (task.type === "wallet") {
          progress = player.wallet ? 1 : 0;
          canClaim = progress === 1;
        }

        // =========================
        // DONATE
        // =========================
        if (task.type === "donate") {
          const { count } = await supabase
            .from("donations")
            .select("*", { count: "exact", head: true })
            .eq("player_id", playerId)
            .eq("status", "confirmed");

          progress = count > 0 ? 1 : 0;
          canClaim = progress === 1;
        }

        // =========================
        // SOCIAL / ACTION
        // =========================
        if (task.type === "social" || task.type === "action") {
          progress = completedSet.has(task.id) ? 1 : 0;
          canClaim = progress === 1;
        }

        const isCompleted = completedSet.has(task.id);

        result.push({
          ...task,
          progress,
          required,
          completed: isCompleted,
          canClaim: !isCompleted && canClaim
        });
      }

      return res.json({ tasks: result });
    }

    // =====================================================
    // CLAIM TASK
    // =====================================================
    if (action === "claim") {
      const { taskId } = body;

      if (!taskId) {
        return res.status(400).json({ error: "taskId required" });
      }

      const { data: task } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const { data: completed } = await supabase
        .from("player_tasks")
        .select("id")
        .eq("player_id", playerId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (completed) {
        return res.status(400).json({ error: "Task already claimed" });
      }

      // повторная проверка условий
      let allowed = false;

      if (task.type === "wallet") {
        allowed = !!player.wallet;
      }

      if (task.type === "donate") {
        const { count } = await supabase
          .from("donations")
          .select("*", { count: "exact", head: true })
          .eq("player_id", playerId)
          .eq("status", "confirmed");

        allowed = count > 0;
      }

      if (task.type === "referral") {
        const { data: refs } = await supabase
          .from("players")
          .select("id")
          .eq("referrer_id", telegramId);

        allowed = refs.length >= (task.metadata?.required ?? 1);
      }

      if (task.type === "progress") {
        const { count } = await supabase
          .from("game_sessions")
          .select("*", { count: "exact", head: true })
          .eq("player_id", playerId)
          .eq("result", "win")
          .eq("game_scenarios.type", task.metadata.gameType);

        allowed = count >= (task.metadata?.required ?? 1);
      }

      if (!allowed) {
        return res.status(400).json({ error: "Task not completed yet" });
      }

      // начисляем награду
      await supabase.rpc("increment_balance", {
        player_id: playerId,
        amount: task.reward
      });

      await supabase.from("completed_tasks").insert({
        player_id: playerId,
        task_id: taskId
      });

      return res.json({
        success: true,
        reward: task.reward
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
