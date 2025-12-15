const params = new URLSearchParams(window.location.search);
const referrerId = params.get("referrer");

const tg = window.Telegram.WebApp;
tg.ready();

const user = tg.initDataUnsafe.user;
let sessionId = null;

const gameDiv = document.getElementById("game");

async function loadUser() {
  const res = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: user.id,
      username: user.username,
      referrerId
    })
  });

  const data = await res.json();
  document.getElementById("balance").innerText =
    `Баланс: ${data.balance} очков`;
}

async function startGame() {
  const res = await fetch("/api/start_game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: user.id })
  });

  const data = await res.json();
  sessionId = data.sessionId;
  renderStep(data.firstStep);
}

function renderStep(step) {
  gameDiv.innerHTML = `<p>${step.text}</p>`;

  step.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.innerText = opt.text;
    btn.onclick = () => sendChoice(opt.id);
    gameDiv.appendChild(btn);
  });
}

async function sendChoice(choice) {
  const res = await fetch("/api/game_step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, choice })
  });

  const data = await res.json();

  if (data.status) {
    gameDiv.innerHTML =
      data.status === "won"
        ? `🎉 Победа! +${data.reward} очков`
        : "❌ Поражение. Попробуй ещё раз.";

    loadUser();
  } else {
    renderStep(data);
  }
}

document.getElementById("play").onclick = startGame;

loadUser();
