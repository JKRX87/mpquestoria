const users = new Map(); // временное хранилище (потом заменим на БД)

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { telegramId, username } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: "No telegramId" });
  }

  if (!users.has(telegramId)) {
    users.set(telegramId, {
      balance: 0,
      username: username || "Player"
    });
  }

  const user = users.get(telegramId);

  res.status(200).json({
    balance: user.balance,
    username: user.username
  });
}
