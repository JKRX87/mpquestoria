import { createClient } from "@supabase/supabase-js";
import { generateText } from "../lib/llm";
import { GAME_SYSTEM_PROMPT } from "../lib/gamePrompt";
import { makeStoryFingerprint } from "../lib/storyFingerprint";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const GAME_LIMITS = {
  simple: 15,
  advanced: 30,
  realistic: 50
};

const GAME_POINTS = {
  simple: { basic: 10, custom: 15 },
  advanced: { basic: 20, custom: 30 },
  realistic: { basic: 40, custom: 60 }
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
      const { telegramId, gameType, gameMode, userInput } = req.body;

      if (!telegramId || !gameType || !gameMode) {
        return res.status(400).json({ error: "Missing params" });
      }

      const limit = GAME_LIMITS[gameType];
      if (!limit) {
        return res.status(400).json({ error: "Invalid gameType" });
      }

      // Проверяем активную игру
      const { data: activeGame } = await supabase
        .from("game_sessions")
        .select("id, current_step, max_steps, intro")
        .eq("player_id", telegramId)
        .eq("status", "active")
        .maybeSingle();

      if (activeGame) {
        return res.status(409).json({
          hasActiveGame: true,
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
          ? `Create a game with the following user preferences:\n${userInput || ""}`
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
      const fingerprint = makeStoryFingerprint(intro);

      const { data: inserted, error: insertError } = await supabase
        .from("game_sessions")
        .insert({
          player_id: telegramId,
          game_type: gameType,
          game_mode: gameMode,
          status: "active",
          goal: intro.goal,
          intro,
          current_step: 0,
          max_steps: limit,
          story_fingerprint: fingerprint
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.json({
        sessionId: inserted.id,
        intro
      });
    } catch (err) {
      console.error("START GAME ERR:", err);
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

      const nextStep = session.current_step + 1;
      const isFinal = nextStep >= session.max_steps;

      const { data: steps } = await supabase
        .from("game_steps")
        .select("situation")
        .eq("game_id", sessionId)
        .order("step_number");

      const historyText = steps.map(s => s.situation).join("\n");

      const text = await generateText(`
Ты продолжаешь уникальную интерактивную историю.
Запрещено повторять события.

Контекст:
${historyText}

Цель: ${session.goal}
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
            .map((t, i) => ({
              id: i + 1,
              text: t.replace(/^\d+\.\s*/, "")
            }));

      await supabase.from("game_steps").insert({
        game_id: sessionId,
        step_number: nextStep,
        situation,
        choices,
        chosen_index: choice
      });

      let finished = false;
      let points = 0;

      if (isFinal) {
        const win = situation.toLowerCase().includes("цель достигнута");

        if (win) {
          points = GAME_POINTS[session.game_type][session.game_mode];
          await supabase.rpc("increment_balance", {
            player_id: session.player_id,
            amount: points
          });
        }

        await supabase
          .from("game_sessions")
          .update({
            status: win ? "win" : "alternative",
            success: win,
            points_earned: points,
            finished_at: new Date()
          })
          .eq("id", sessionId);

        finished = true;
      } else {
        await supabase
          .from("game_sessions")
          .update({ current_step: nextStep })
          .eq("id", sessionId);
      }

      return res.json({ situation, choices, finished });
    } catch (err) {
      console.error("STEP GAME ERR:", err);
      return res.status(500).json({ error: "Game step failed" });
    }
  }

  // =========================
  // GAME HISTORY
  // =========================
  if (action === "history") {
    try {
      const { telegramId } = req.query;

      const { data } = await supabase
        .from("game_sessions")
        .select(
          "id, game_type, game_mode, status, success, points_earned, created_at"
        )
        .eq("player_id", telegramId)
        .order("created_at", { ascending: false });

      return res.json({ games: data });
    } catch (err) {
      console.error("HISTORY ERR:", err);
      return res.status(500).json({ error: "History failed" });
    }
  }

  // =========================
  // GAME DETAILS
  // =========================
  if (action === "details") {
    try {
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

      const intro = session.intro;

      const story = steps.map(s => ({
        step: s.step_number,
        text: s.situation,
        choice: s.chosen_index
      }));

      return res.json({
        game: {
          type: session.game_type,
          mode: session.game_mode,
          success: session.success,
          points: session.points_earned,
          created_at: session.created_at,
          finished_at: session.finished_at
        },
        intro,
        story
      });
    } catch (err) {
      console.error("DETAILS ERR:", err);
      return res.status(500).json({ error: "Details failed" });
    }
  }

  // =========================
  // ABANDON GAME
  // =========================
  if (action === "abandon") {
    try {
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
    } catch (err) {
      console.error("ABANDON ERR:", err);
      return res.status(500).json({ error: "Abandon failed" });
    }
  }

  return res.status(400).json({ error: "Unknown game action" });
}
