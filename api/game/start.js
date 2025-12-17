import { createClient } from "@supabase/supabase-js";
import { openai } from "../../../lib/openai";
import { GAME_SYSTEM_PROMPT } from "../../../lib/gamePrompt";

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      telegramId,
      gameType,     // simple | advanced | realistic
      gameMode,     // basic | custom
      userInput     // optional (for custom)
    } = req.body;

    if (!telegramId || !gameType || !gameMode) {
      return res.status(400).json({ error: "Missing params" });
    }

    const limit = GAME_LIMITS[gameType];
    if (!limit) {
      return res.status(400).json({ error: "Invalid gameType" });
    }

    // ===== USER PROMPT =====
    let userPrompt = "";

    if (gameMode === "custom") {
      userPrompt = `
Create a game with the following user preferences:
${userInput || "No additional input provided"}
`;
    } else {
      userPrompt = "Create a completely original game.";
    }

    // ===== GPT CALL =====
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 1.1,
      messages: [
        { role: "system", content: GAME_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    });

    const content = completion.choices[0].message.content;
    const intro = JSON.parse(content);

    // ===== SAVE GAME =====
    const { data: game, error } = await supabase
      .from("games")
      .insert({
        player_id: telegramId,
        game_type: gameType,
        game_mode: gameMode,
        title: intro.title,
        setting: intro.setting,
        role: intro.role,
        goal: intro.goal,
        max_steps: limit.maxSteps,
        history: [
          {
            step: 0,
            type: "intro",
            content: intro
          }
        ]
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      gameId: game.id,
      intro
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Game start failed" });
  }
}
