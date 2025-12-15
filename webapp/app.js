// =====================
// Telegram WebApp init
// =====================
function waitForTelegramWebApp(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const interval = 50;
    let waited = 0;

    const check = () => {
      if (window.Telegram && window.Telegram.WebApp) {
        resolve(window.Telegram.WebApp);
      } else if (waited >= timeout) {
        reject("Telegram WebApp недоступен");
      } else {
        waited += interval;
        setTimeout(check, interval);
      }
    };

    check();
  });
}

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

  // load fresh data only if user is initialized
  if (!window.appUser) return;

  if (name === "home") loadUser();
  if (name === "friends") loadReferrals();
  if (name === "tasks") loadReferralTask();
  if (name === "rating") loadLeaderboard();
}

document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});

// =====================
// API functions
// =====================
async function loadUser() {
  if (!window.appUser) return;
  try {
    const res = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: window.appUser.id,
        username: window.appUser.username,
        referrerId: new URLSearchParams(window.location.search).get("referrer")
      })
    });
    const data = await res.json();
    document.getElementById("balance").innerText = `Баланс: ${data.balance ?? 0} очков`;
  } catch (e) {
    console.error(e);
    document.getElementById("balance").innerText = `Баланс: 0 очков`;
  }
}

async function loadReferrals() {
  if (!window.appUser) return;
  try {
    const res = await fetch(`/api/referrals?telegramId=${window.appUser.id}`);
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

async function loadReferralTask() {
  if (!window.appUser) return;
  try {
    const res = await fetch(`/api/referral_task?telegramId=${window.appUser.id}`);
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
  if (!window.appUser) return;
  try {
    const res = await fetch("/api/claim_referral_task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId: window.appUser.id })
    });
    const data = await res.json();
    if (data.success) {
      loadUser();
      loadReferralTask();
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadLeaderboard() {
  if (!window.appUser) return;
  try {
    const res = await fetch(`/api/leaderboard?telegramId=${window.appUser.id}`);
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
  if (!window.appUser) return;
  const botLink = `https://t.me/MPquestoria_bot?start=ref_${window.appUser.id}`;
  const text = encodeURIComponent("🚀 Присоединяйся к MP Questoria!");
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${text}`;
  window.Telegram.WebApp.openTelegramLink(shareUrl);
};

// =====================
// Init app
// =====================
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await waitForTelegramWebApp();
    const initUser = window.Telegram.WebApp.initDataUnsafe.user;
    if (!initUser) throw new Error("Не удалось получить данные пользователя");

    window.appUser = {
      id: initUser.id,
      username: initUser.username || initUser.first_name
    };

    // показать главный экран
    showScreen("home");

    // загрузка данных с БД
    await loadUser();
    await loadReferrals();
    await loadReferralTask();
    await loadLeaderboard();

  } catch (e) {
    alert("⚠️ Telegram WebApp недоступен. Откройте WebApp через Telegram.");
    console.error(e);
  }
});
