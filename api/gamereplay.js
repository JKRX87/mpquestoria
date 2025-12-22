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

    // =====================================================
    // 1. Получаем сессию + сценарий
    // =====================================================
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select(`
        id,
        result,
        created_at,
        game_scenarios (
          title,
          type,
          game_number
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // =====================================================
    // 2. Получаем шаги прохождения (в порядке прохождения)
    // =====================================================
    const { data: steps, error: stepsError } = await supabase
  .from("game_session_steps")
  .select("step_id, choice_id, step_key, created_at")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: true });

    if (stepsError) {
      return res.status(500).json({ error: "Steps load failed" });
    }

    // 🔒 Защита: если шагов нет — возвращаем пустую историю
    if (!steps || steps.length === 0) {
      return res.json({
        scenario: session.game_scenarios.title,
        type: session.game_scenarios.type,
        gameNumber: session.game_scenarios.game_number,
        result: session.result,
        createdAt: session.created_at,
        replay: []
      });
    }

    // =====================================================
    // 3. Получаем тексты шагов
    // =====================================================
    const stepIds = steps.map(s => s.step_id);

    const { data: stepTexts } = await supabase
      .from("game_steps")
      .select("id, story")
      .in("id", stepIds);

    // 👉 Map для быстрого доступа (id → story)
    const stepTextMap = new Map(
      (stepTexts ?? []).map(s => [s.id, s.story])
    );

    // =====================================================
    // 4. Получаем тексты выборов
    // =====================================================
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

    // 👉 Map для быстрого доступа (id → choice_text)
    const choiceTextMap = new Map(
      choices.map(c => [c.id, c.choice_text])
    );

    // =====================================================
    // 5. Собираем replay (story → choice → story → ...)
    // =====================================================
    const replay = [];

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];

  // 1. текст текущего шага
  const story = stepTexts.find(
    t => t.id === step.step_id
  )?.story;

  if (story) {
    replay.push({
      type: "story",
      text: story
    });
  }

  // 2. выбор, который ведёт К СЛЕДУЮЩЕМУ шагу
  const nextStep = steps[i + 1];

  if (nextStep?.choice_id) {
    const choice = choices.find(
      c => c.id === nextStep.choice_id
    )?.choice_text;

    if (choice) {
      replay.push({
        type: "choice",
        text: choice
      });
    }
  }
}

    // =====================================================
    // 6. Ответ
    // =====================================================
    return res.json({
      scenario: session.game_scenarios.title,
      type: session.game_scenarios.type,
      gameNumber: session.game_scenarios.game_number,
      result: session.result,
      createdAt: session.created_at,
      replay
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
