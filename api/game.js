import { createClient } from "@supabase/supabase-js";
import { generateText } from "../lib/llm";
import { GAME_SYSTEM_PROMPT } from "../lib/gamePrompt";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const GAME_LIMITS = {
  simple: { maxSteps: 15 },
  advanced: { maxSteps: 30 },
  realistic: { maxSteps: 50 }
};

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method !== "POST" && action !== "history") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // =========================
  // START GAME
  // =========================
  if (action === "start") {
    try {
      const {
        telegramId,
        gameType,   // simple | advanced | realistic
        gameMode,   // basic | custom
        userInput
      } = req.body;

      if (!telegramId || !gameType || !gameMode) {
        return res.status(400).json({ error: "Missing params" });
      }

      const limit = GAME_LIMITS[gameType];
      if (!limit) {
        return res.status(400).json({ error: "Invalid gameType" });
      }

      const userPrompt =
        gameMode === "custom"
          ? `Create a game with user preferences:\n${userInput || "No input"}`
          : "Create a completely original game.";

      const raw = await generateText(`
${GAME_SYSTEM_PROMPT}

${userPrompt}

Ответь строго в JSON:
{
  "title": "...",
  "setting": "...",
  "role": "...",
  "goal": "..."
}
`);

const intro = JSON.parse(raw);

      const { data: game, error } = await supabase
        .from("game_sessions")
        .insert({
          player_id: telegramId,
          game_type: gameType,
          game_source: gameMode,
          status: "active",
          goal: intro.goal,
          intro: JSON.stringify(intro),
          steps_count: 0,
          max_steps: limit.maxSteps
        })
        .select()
        .single();

      if (error) throw error;

      return res.json({
        sessionId: game.id,
        intro
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Game start failed" });
    }
  }

  // =========================
  // GAME STEP
  // =========================
  if (action === "step") {
    try {
      const { sessionId, choice } = req.body;

      const { data: session } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "Game not active" });
      }

      const { data: steps } = await supabase
        .from("game_steps")
        .select("*")
        .eq("session_id", sessionId)
        .order("step_number");

      const history = steps.map(s => s.story).join("\n");
      const nextStep = session.steps_count + 1;
      const isFinal = nextStep >= session.max_steps;

      const text = await generateText(`
Ты продолжаешь уникальную интерактивную историю.
Запрещено повторять сюжет или события.

Контекст:
${history}

Цель игрока: ${session.goal}
Шаг ${nextStep}/${session.max_steps}

${isFinal ? "ЗАВЕРШИ ИСТОРИЮ" : "ПРОДОЛЖАЙ"}

Формат:
STORY:
...
CHOICES:
1. ...
2. ...
3. ...
`);
      const [storyRaw, choicesRaw] = text.split("CHOICES:");

      const story = storyRaw.replace("STORY:", "").trim();
      const choices = isFinal
        ? []
        : choicesRaw
            .trim()
            .split("\n")
            .map((t, i) => ({
              id: i + 1,
              text: t.replace(/^\d+\.\s*/, "")
            }));

      await supabase.from("game_steps").insert({
        session_id: sessionId,
        step_number: nextStep,
        story,
        choices,
        user_choice: choice || null
      });

      await supabase
        .from("game_sessions")
        .update({ steps_count: nextStep })
        .eq("id", sessionId);

      let finished = false;

      if (isFinal) {
        const win = story.toLowerCase().includes("цель достигнута");

        await supabase
          .from("game_sessions")
          .update({
            status: win ? "win" : "alternative",
            success: win,
            finished_at: new Date()
          })
          .eq("id", sessionId);

        finished = true;
      }

      return res.json({
        story,
        choices,
        finished
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Game step failed" });
    }
  }

  // =========================
  // GAME HISTORY
  // =========================
  if (action === "history") {
    const { telegramId } = req.query;

    const { data } = await supabase
      .from("game_sessions")
      .select(
        "id, game_type, game_source, status, success, points_earned, created_at"
      )
      .eq("player_id", telegramId)
      .order("created_at", { ascending: false });

    return res.json({ games: data || [] });
  }

  return res.status(400).json({ error: "Unknown game action" });
}
