// =====================
// Switch screens
// =====================
function showScreen(name) {
  // убираем активность
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  document.querySelectorAll(".bottom-nav button").forEach(b => {
    b.classList.remove("active");
  });

  const screen = document.getElementById(`screen-${name}`);
  const btn = document.querySelector(
    `.bottom-nav button[data-screen="${name}"]`
  );

  // включаем экран с анимацией
  if (screen) {
    requestAnimationFrame(() => {
      screen.classList.add("active");
    });
  }

  if (btn) btn.classList.add("active");

  // подгрузка данных
  if (name === "home") loadUser();
  if (name === "friends") loadReferrals();
  if (name === "tasks") loadReferralTask();
  if (name === "rating") loadLeaderboard();
}

// меню
document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () =>
    showScreen(btn.dataset.screen)
  );
});

// =====================
// API calls
// =====================
async function loadUser() {
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
    document.getElementById("balance").innerText =
      `Баланс: ${data.balance ?? 0} очков`;
  } catch (e) {
    console.error("loadUser error", e);
  }
}

async function loadReferrals() {
  try {
    const res = await fetch(
      `/api/referrals?telegramId=${window.appUser.id}`
    );
    const data = await res.json();

    document.getElementById("refCount").innerText =
      `Приглашено: ${data.count ?? 0}`;

    const list = document.getElementById("refList");
    list.innerHTML = "";

    (data.referrals || []).forEach(r => {
      const li = document.createElement("li");
      li.innerText = r.username || `Игрок ${r.id}`;
      list.appendChild(li);
    });
  } catch (e) {
    console.error("loadReferrals error", e);
  }
}

async function loadReferralTask() {
  try {
    const res = await fetch(
      `/api/referral_task?telegramId=${window.appUser.id}`
    );
    const data = await res.json();

    const info = document.getElementById("taskInfo");
    const btn = document.getElementById("claimTask");

    info.innerText =
      `Пригласи ${data.required} друзей ` +
      `(${data.current}/${data.required}) — ` +
      `награда ${data.reward} очков`;

    if (data.completed) {
      info.innerText += " ✅ Выполнено";
      btn.style.display = "none";
    } else if (data.current >= data.required) {
      btn.style.display = "block";
    } else {
      btn.style.display = "none";
    }
  } catch (e) {
    console.error("loadReferralTask error", e);
  }
}

document.getElementById("claimTask").onclick = async () => {
  try {
    const res = await fetch("/api/claim_referral_task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId: window.appUser.id })
    });

    const data = await res.json();
    if (data.success) {
      alert(`🎉 +${data.reward} очков`);
      loadUser();
      loadReferralTask();
    }
  } catch (e) {
    console.error("claimTask error", e);
  }
};

async function loadLeaderboard() {
  try {
    const res = await fetch(
      `/api/leaderboard?telegramId=${window.appUser.id}`
    );
    const data = await res.json();

    const list = document.getElementById("leaderboardList");
    const pos = document.getElementById("myPosition");

    list.innerHTML = "";

    (data.top || []).forEach(p => {
      const li = document.createElement("li");
      li.innerText =
        `${p.username || "Player"} — ${p.balance} очков`;
      list.appendChild(li);
    });

    pos.innerText = data.position
      ? `📍 Твоя позиция: ${data.position}`
      : "📍 Ты ещё не в рейтинге";
  } catch (e) {
    console.error("loadLeaderboard error", e);
  }
}

// =====================
// Games (stub)
// =====================
document.getElementById("playSimple").onclick =
  () => alert("Запуск простой игры...");
document.getElementById("playHard").onclick =
  () => alert("Запуск усложнённой игры...");
document.getElementById("playReal").onclick =
  () => alert("Запуск реалистичной игры...");

// =====================
// Invite
// =====================
document.getElementById("invite").onclick = () => {
  const tg = window.Telegram.WebApp;
  const botLink =
    `https://t.me/MPquestoria_bot?start=ref_${window.appUser.id}`;
  const text = encodeURIComponent(
    "🚀 Присоединяйся к MP Questoria!"
  );
  tg.openTelegramLink(
    `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${text}`
  );
};

// =====================
// STRICT Telegram init
// =====================
window.addEventListener("DOMContentLoaded", () => {
  if (!window.Telegram || !window.Telegram.WebApp) {
    document.body.innerHTML =
      "<h2 style='color:white'>❌ Открой приложение через Telegram</h2>";
    return;
  }

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;

  if (!user || !user.id) {
    document.body.innerHTML =
      "<h2 style='color:white'>❌ Telegram user не найден</h2>";
    return;
  }

  window.appUser = {
    id: user.id,
    username: user.username || user.first_name || "Player"
  };

  showScreen("home");

  loadUser();
  loadReferrals();
  loadReferralTask();
  loadLeaderboard();
});
