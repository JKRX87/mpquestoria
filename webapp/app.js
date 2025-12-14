const tg = window.Telegram.WebApp;
tg.ready();

const user = tg.initDataUnsafe?.user;

async function loadUser() {
  if (!user) {
    alert("Не удалось получить данные пользователя");
    return;
  }

  const response = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: user.id,
      username: user.username
    })
  });

  const data = await response.json();
  document.getElementById("balance").innerText = `Баланс: ${data.balance} очков`;
}

loadUser();

document.getElementById("play").onclick = async () => {
  const res = await fetch("/api/start_game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: user.id })
  });

  const game = await res.json();

  alert(`${game.firstStep.text}\n1️⃣ ${game.firstStep.options[0].text}\n2️⃣ ${game.firstStep.options[1].text}`);
};
