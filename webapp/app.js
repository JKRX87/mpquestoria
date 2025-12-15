// =====================
// Telegram WebApp init / MOCK
// =====================
if (!window.Telegram || !window.Telegram.WebApp) {
  console.warn("⚠️ Telegram WebApp недоступен, используем MOCK для локальной разработки.");
  window.Telegram = window.Telegram || {};
  window.Telegram.WebApp = {
    initDataUnsafe: {
      user: { id: 123, username: "TestUser", first_name: "Test" }
    },
    openTelegramLink: (url) => {
      console.log("MOCK: открыть ссылку:", url);
      alert("MOCK: откройте ссылку в Telegram: " + url);
    }
  };
}

const tg = window.Telegram.WebApp;
const initUser = tg.initDataUnsafe.user;

let user = {
  id: initUser?.id || 0,
  username: initUser?.username || initUser?.first_name || ""
};

const params = new URLSearchParams(window.location.search);
const referrerId = params.get("referrer");

// =====================
// Switch screens
// =====================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));

  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add("active");

  const btn = document.querySelector(`.bottom-nav button[data-screen="${name}"]`);
  if (btn) btn.classList.add("active");

  // load fresh data
  if (name === "home") loadUser();
  if (name === "friends") loadReferrals();
  if (name === "tasks") loadReferralTask();
  if (name === "rating") loadLeaderboard();
}

document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});

// =====================
// Load user balance
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
    document.getElementById("balance").innerText = `Баланс: ${data.balance ?? 0} очков`;
  } catch (e) {
    console.error(e);
    document.getElementById("balance").innerText = `Баланс: 0 очков`;
  }
}

// =====================
// Load referrals
// =====================
async function loadReferrals() {
  try {
    const res = await fetch(`/api/referrals?telegramId=${user.id}`);
    const data = await res.json();
    document.getElementById("refCount").innerText = `Приглашено: ${data.count ?? 0}`;
    const list = document.getElementById("refList");
    list.innerHTML = "";
    (data.referrals ?? []).forEach(ref => {
      const li = document.createElement("li");
      li.innerText = ref.username || `Игрок ${ref.id}`;
      list.appendChild(li);
    });
  } catch (e) {
    console.error(e);
  }
}

// =====================
// Referral task
// =====================
async function loadReferralTask() {
  try {
    const res = await fetch(`/api/referral_task?telegramId=${user.id}`);
    const data = await res.json();
    const info = document.getElementById("taskInfo");
    const button = document.getElementById("claimTask");

    info.innerText = `Пригласи ${data.required} друзей (${data.current}/${data.required}) — награда ${data.reward} очков`;

    button.style.display = data.completed || data.current < data.required ? "none" : "block";
    if (data.completed) info.innerText += " ✅ Выполнено";
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
      loadUser();
      loadReferralTask();
    }
  } catch (e) {
    console.error(e);
  }
};

// =====================
// Leaderboard
// =====================
async function loadLeaderboard() {
  try {
    const res = await fetch(`/api/leaderboard?telegramId=${user.id}`);
    const data = await res.json();
    const list = document.getElementById("leaderboardList");
    const pos = document.getElementById("myPosition");
    list.innerHTML = "";
    (data.top ?? []).forEach(p => {
      const li = document.createElement("li");
      li.innerText = `${p.username || "Player"} — ${p.balance} очков`;
      list.appendChild(li);
    });
    pos.innerText = data.position ? `📍 Твоя позиция: ${data.position}` : "📍 Ты ещё не в рейтинге";
  } catch (e) {
    console.error(e);
  }
}

// =====================
// Games buttons
// =====================
document.getElementById("playSimple").onclick = () => alert("Запуск простой игры...");
document.getElementById("playHard").onclick = () => alert("Запуск усложненной игры...");
document.getElementById("playReal").onclick = () => alert("Запуск реалистичной игры...");

// =====================
// Invite friends
// =====================
document.getElementById("invite").onclick = () => {
  const botLink = `https://t.me/MPquestoria_bot?start=ref_${user.id}`;
  const text = encodeURIComponent("🚀 Присоединяйся к MP Questoria!");
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${text}`;
  tg.openTelegramLink(shareUrl);
};

// =====================
// Initial load
// =====================
window.addEventListener("DOMContentLoaded", () => {
  showScreen("home");
  loadUser();
  loadReferrals();
  loadReferralTask();
  loadLeaderboard();
});
