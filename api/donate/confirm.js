import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { donationId, txHash } = req.body;

  if (!donationId || !txHash) {
    return res.status(400).json({ error: "Invalid data" });
  }

  // MVP: считаем транзакцию успешной
  const { error } = await supabase
    .from("donations")
    .update({
      tx_hash: txHash,
      status: "confirmed"
    })
    .eq("id", donationId)
    .eq("status", "pending");

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ success: true });
}
