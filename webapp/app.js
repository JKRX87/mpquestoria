// Telegram WebApp инициализация
const tg = window.Telegram.WebApp;

// =====================
// Пользователь
// =====================
let user = {
  id: tg.initDataUnsafe.user.id,
  username: tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name
};
const params = new URLSearchParams(window.location.search);
const referrerId = params.get("referrer");

// =====================
// Общая логика экранов
// =====================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));

  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add("active");

  const btn = document.querySelector(`.bottom-nav button[data-screen="${name}"]`);
  if (btn) btn.classList.add("active");

  // обновляем данные при переключении экрана
  if (name === "home") loadUser();
  if (name === "friends") loadReferrals();
  if (name === "tasks") loadReferralTask();
  if (name === "rating") loadLeaderboard();
}

// назначаем клики на кнопки меню
document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});

// экран по умолчанию
showScreen("home");

// =====================
// Функции для загрузки данных
// =====================
async function loadUser() {
  try {
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
    if (data.balance !== undefined) {
      document.getElementById("balance").innerText = `Баланс: ${data.balance} очков`;
    } else {
      document.getElementById("balance").innerText = `Баланс: 0 очков`;
    }
  } catch (e) {
    console.error(e);
    document.getElementById("balance").innerText = `Баланс: 0 очков`;
  }
}

async function loadReferrals() {
  try {
    const res = await fetch(`/api/referrals?telegramId=${user.id}`);
    const data = await res.json();
    document.getElementById("refCount").innerText = `Приглашено: ${data.count || 0}`;
    const list = document.getElementById("refList");
    list.innerHTML = "";
    (data.referrals || []).forEach(ref => {
      const li = document.createElement("li");
      li.innerText = ref.username || `Игрок ${ref.id}`;
      list.appendChild(li);
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadReferralTask() {
  try {
    const res = await fetch(`/api/referral_task?telegramId=${user.id}`);
    const data = await res.json();
    const info = document.getElementById("taskInfo");
    const button = document.getElementById("claimTask");

    info.innerText = `Пригласи ${data.required} друзей (${data.current}/${data.required}) — награда ${data.reward} очков`;

    if (data.completed) {
      button.style.display = "none";
      info.innerText += " ✅ Выполнено";
    } else if (data.current >= data.required) {
      button.style.display = "block";
    } else {
      button.style.display = "none";
    }
  } catch (e) {
    console.error(e);
  }
}

document.getElementById("claimTask").onclick = async () => {
  try {
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
  } catch (e) {
    console.error(e);
  }
}

async function loadLeaderboard() {
  try {
    const res = await fetch(`/api/leaderboard?telegramId=${user.id}`);
    const data = await res.json();
    const list = document.getElementById("leaderboardList");
    const pos = document.getElementById("myPosition");
    list.innerHTML = "";

    (data.top || []).forEach(player => {
      const li = document.createElement("li");
      li.innerText = `${player.username || "Player"} — ${player.balance} очков`;
      list.appendChild(li);
    });

    if (data.position) {
      pos.innerText = `📍 Твоя позиция: ${data.position}`;
    } else {
      pos.innerText = "📍 Ты ещё не в рейтинге";
    }
  } catch (e) {
    console.error(e);
  }
}

// =====================
// Игры
// =====================
document.getElementById("playSimple").onclick = () => alert("Запуск простой игры...");
document.getElementById("playHard").onclick = () => alert("Запуск усложненной игры...");
document.getElementById("playReal").onclick = () => alert("Запуск реалистичной игры...");

// =====================
// Друзья / приглашение
// =====================
document.getElementById("invite").onclick = () => {
  const botLink = `https://t.me/MPquestoria_bot?start=ref_${user.id}`;
  const text = encodeURIComponent("🚀 Присоединяйся к MP Questoria! Играй и зарабатывай очки.");
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${text}`;
  tg.openTelegramLink(shareUrl);
};

// =====================
// Первичная загрузка данных
// =====================
loadUser();
loadReferrals();
loadReferralTask();
loadLeaderboard();
