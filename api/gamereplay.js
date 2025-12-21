import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId required" });
  }

  // шаги прохождения
 const { data: steps, error } = await supabase
  .from("game_session_steps")
  .select(`
    created_at,
    game_steps (
      story,
      step_key
    ),
    game_choices (
      choice_text
    )
  `)
  .eq("session_id", sessionId)
  .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load replay" });
  }

  return res.json({ steps });
}
