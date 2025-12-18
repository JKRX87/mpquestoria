import { createClient } from "@supabase/supabase-js";
import { generateText } from "../lib/llm.js";
import { GAME_SYSTEM_PROMPT } from "../lib/gamePrompt.js";
import { makeStoryFingerprint } from "../lib/storyFingerprint.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const GAME_LIMITS = {
  simple: { maxSteps: 15 },
  advanced: { maxSteps: 30 },
  realistic: { maxSteps: 50 }
};

const GAME_POINTS = {
  simple: { basic: 10, custom: 15 },
  advanced: { basic: 20, custom: 30 },
  realistic: { basic: 40, custom: 60 }
};

export default async function handler(req, res) {
  const { action } = req.query;

  if (
    req.method !== "POST" &&
    action !== "history" &&
    action !== "details"
  ) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // =========================
    // START GAME
    // =========================
    if (action === "start") {
      const { telegramId, gameType, gameMode, userInput } = req.body;

      if (!telegramId || !gameType || !gameMode) {
        return res.status(400).json({ error: "Missing params" });
      }

      const limit = GAME_LIMITS[gameType];
      if (!limit) {
        return res.status(400).json({ error: "Invalid gameType" });
      }

      const { data: activeGame } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("player_id", telegramId)
        .eq("status", "active")
        .maybeSingle();

      if (activeGame) {
        return res.status(409).json({
          sessionId: activeGame.id,
          intro: activeGame.intro,
          progress: {
            current: activeGame.current_step,
            total: activeGame.max_steps
          }
        });
      }

      const userPrompt =
        gameMode === "custom"
          ? `Create a story with player preferences:\n${userInput || ""}`
          : "Create a completely original interactive story.";

      const raw = await generateText(`
${GAME_SYSTEM_PROMPT}

${userPrompt}

Return strict JSON:
{
  "title": "...",
  "setting": "...",
  "role": "...",
  "goal": "..."
}
      `);

      const intro = JSON.parse(raw);
      const fingerprint = makeStoryFingerprint(intro);

      const { data: game, error } = await supabase
        .from("game_sessions")
        .insert({
          player_id: telegramId,
          game_type: gameType,
          game_mode: gameMode,
          status: "active",
          goal: intro.goal,
          intro,
          current_step: 0,
          max_steps: limit.maxSteps,
          story_fingerprint: fingerprint
        })
        .select()
        .single();

      if (error) throw error;

      return res.json({
        sessionId: game.id,
        intro
      });
    }

    // =========================
    // GAME STEP
    // =========================
    if (action === "step") {
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
        .eq("game_id", sessionId)
        .order("step_number");

      const history = steps.map(s => s.situation).join("\n");
      const nextStep = session.current_step + 1;
      const isFinal = nextStep >= session.max_steps;

      const text = await generateText(`
Ты продолжаешь интерактивную историю.
Не повторяй события.

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
      const situation = storyRaw.replace("STORY:", "").trim();

      const choices = isFinal
        ? []
        : choicesRaw
            .trim()
            .split("\n")
            .map(t => t.replace(/^\d+\.\s*/, ""));

      await supabase.from("game_steps").insert({
        game_id: sessionId,
        step_number: nextStep,
        situation,
        choices,
        chosen_index: choice ?? null
      });

      let finished = false;

      if (isFinal) {
        const win = situation.toLowerCase().includes("цель");
        const points =
          win ? GAME_POINTS[session.game_type][session.game_mode] : 0;

        await supabase
          .from("game_sessions")
          .update({
            status: win ? "win" : "alternative",
            success: win,
            points_earned: points,
            finished_at: new Date(),
            current_step: nextStep
          })
          .eq("id", sessionId);

        finished = true;
      } else {
        await supabase
          .from("game_sessions")
          .update({ current_step: nextStep })
          .eq("id", sessionId);
      }

      return res.json({
        story: situation,
        choices: choices.map((t, i) => ({ id: i + 1, text: t })),
        finished
      });
    }

    // =========================
    // GAME HISTORY
    // =========================
    if (action === "history") {
      const { telegramId } = req.query;

      const { data } = await supabase
        .from("game_sessions")
        .select(
          "id, game_type, game_mode, status, success, points_earned, created_at"
        )
        .eq("player_id", telegramId)
        .order("created_at", { ascending: false });

      return res.json({ games: data || [] });
    }

    // =========================
    // GAME DETAILS
    // =========================
    if (action === "details") {
      const { sessionId } = req.query;

      const { data: session } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      const { data: steps } = await supabase
        .from("game_steps")
        .select("*")
        .eq("game_id", sessionId)
        .order("step_number");

      return res.json({
        game: {
          type: session.game_type,
          mode: session.game_mode,
          success: session.success,
          points: session.points_earned,
          created_at: session.created_at,
          finished_at: session.finished_at
        },
        intro: session.intro,
        story: steps.map(s => ({
          step: s.step_number,
          text: s.situation,
          choice: s.chosen_index
        }))
      });
    }

    // =========================
    // ABANDON GAME
    // =========================
    if (action === "abandon") {
      const { telegramId } = req.body;

      await supabase
        .from("game_sessions")
        .update({
          status: "abandoned",
          finished_at: new Date()
        })
        .eq("player_id", telegramId)
        .eq("status", "active");

      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Unknown game action" });
  } catch (err) {
    console.error("GAME API ERROR:", err);
    return res.status(500).json({ error: "Game failed" });
  }
}
