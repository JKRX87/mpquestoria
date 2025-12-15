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

async function loadReferrals() {
  const res = await fetch(`/api/referrals?telegramId=${user.id}`);
  const data = await res.json();

  document.getElementById("refCount").innerText =
    `Приглашено: ${data.count}`;

  const list = document.getElementById("refList");
  list.innerHTML = "";

  data.referrals.forEach(ref => {
    const li = document.createElement("li");
    li.innerText = ref.username || `Игрок ${ref.id}`;
    list.appendChild(li);
  });
}

async function loadReferralTask() {
  const res = await fetch(`/api/referral_task?telegramId=${user.id}`);
  const data = await res.json();

  const info = document.getElementById("taskInfo");
  const button = document.getElementById("claimTask");

  info.innerText =
    `Пригласи ${data.required} друзей (${data.current}/${data.required}) — награда ${data.reward} очков`;

  if (data.completed) {
    button.style.display = "none";
    info.innerText += " ✅ Выполнено";
  } else if (data.current >= data.required) {
    button.style.display = "block";
  } else {
    button.style.display = "none";
  }
}

loadReferralTask();

document.getElementById("invite").onclick = () => {
  const botLink = `https://t.me/MPquestoria_bot?start=ref_${user.id}`;
  const text = encodeURIComponent(
    "🚀 Присоединяйся к MP Questoria! Играй, проходи квесты и зарабатывай очки."
  );

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    botLink
  )}&text=${text}`;

  tg.openTelegramLink(shareUrl);
};

loadReferrals();

document.getElementById("play").onclick = startGame;

loadUser();

document.getElementById("claimTask").onclick = async () => {
  const res = await fetch("/api/claim_referral_task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: user.id })
  });

  const data = await res.json();

  if (data.success) {
    alert(`🎉 Награда получена: +${data.reward} очков`);
    loadUser();
    loadReferralTask();
  } else {
    alert(data.error);
  }
};
