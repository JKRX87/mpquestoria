import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    // 1. получаем сессию
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select(`
        id,
        result,
        created_at,
        game_scenarios (
          title
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // 2. получаем шаги прохождения (БЕЗ JOIN!)
    const { data: steps, error: stepsError } = await supabase
      .from("game_session_steps")
      .select("step_id, choice_id, step_key")
      .eq("session_id", sessionId)
      .order("id", { ascending: true });

    if (stepsError) {
      return res.status(500).json({ error: "Steps load failed" });
    }

    // 3. получаем тексты шагов
    const stepIds = steps.map(s => s.step_id);

    const { data: stepTexts } = await supabase
      .from("game_steps")
      .select("id, story")
      .in("id", stepIds);

    // 4. получаем тексты выборов
    const choiceIds = steps
      .map(s => s.choice_id)
      .filter(Boolean);

    let choices = [];
    if (choiceIds.length > 0) {
      const resChoices = await supabase
        .from("game_choices")
        .select("id, choice_text")
        .in("id", choiceIds);

      choices = resChoices.data ?? [];
    }

// 5. собираем replay (цепочка story → choice)
const replay = [];

steps.forEach(step => {
  const storyText =
    stepTexts.find(t => t.id === step.step_id)?.story ?? "";

  // текст шага
  replay.push({
    type: "story",
    text: storyText
  });

  // выбор после шага (если был)
  if (step.choice_id) {
    const choiceText =
      choices.find(c => c.id === step.choice_id)?.choice_text ?? null;

    if (choiceText) {
      replay.push({
        type: "choice",
        text: choiceText
      });
    }
  }
});

    return res.json({
      scenario: session.game_scenarios.title,
      result: session.result,
      createdAt: session.created_at,
      replay
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
