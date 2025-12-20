// =====================
// Telegram WebApp init
// =====================
const tg = window.Telegram?.WebApp;
if (!tg) {
  alert("❌ Открой приложение через Telegram");
  throw new Error("Telegram WebApp not found");
}
tg.ready();

const user = tg.initDataUnsafe?.user;
if (!user?.id) {
  alert("❌ Не удалось получить пользователя Telegram");
  throw new Error("Telegram user not found");
}

window.appUser = {
  id: Number(user.id),
  username: user.username || user.first_name || "Player"
};

// =====================
// TON Connect
// =====================
let tonConnectUI = null;
let connectedWallet = null;

const walletButton = document.getElementById("linkWallet");

function shortAddress(addr) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function setWalletButtonDefault() {
  walletButton.innerText = "🔗 Привязать кошелёк";
}

function setWalletButtonConnected(address) {
  walletButton.innerText = `💼 ${shortAddress(address)}`;
}

function initTonConnect() {
  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: `${window.location.origin}/webapp/tonconnect-manifest.json`
  });

  if (tonConnectUI.wallet) {
    connectedWallet = tonConnectUI.wallet;
    onWalletConnected(connectedWallet);
  }

  tonConnectUI.onStatusChange(wallet => {
    connectedWallet = wallet;
    wallet ? onWalletConnected(wallet) : setWalletButtonDefault();
  });
}

async function onWalletConnected(wallet) {
  const address = wallet.account.address;
  setWalletButtonConnected(address);

  await fetch("/api/user?action=wallet", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    telegramId: window.appUser.id,
    wallet: address
  })
});
}

// =====================
// Wallet modal
// =====================
const walletModal = document.getElementById("walletModal");
document.getElementById("closeWalletModal").onclick = () =>
  walletModal.classList.add("hidden");

document.getElementById("reconnectWallet").onclick = async () => {
  walletModal.classList.add("hidden");
  await tonConnectUI.openModal();
};

document.getElementById("disconnectWallet").onclick = async () => {
  await tonConnectUI.disconnect();
  connectedWallet = null;
  setWalletButtonDefault();
  walletModal.classList.add("hidden");
};

walletButton.onclick = async () => {
  if (!connectedWallet) {
    await tonConnectUI.openModal();
  } else {
    walletModal.classList.remove("hidden");
  }
};

// =====================
// Screens
// =====================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));

  document.getElementById(`screen-${name}`)?.classList.add("active");
  document.querySelector(`.bottom-nav button[data-screen="${name}"]`)?.classList.add("active");

  if (name === "home") loadUser();
  if (name === "friends") loadReferrals();
  if (name === "tasks") loadReferralTask();
  if (name === "rating") loadLeaderboard();
}

document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.onclick = () => showScreen(btn.dataset.screen);
});

// =====================
// API
// =====================
async function loadUser() {
  const res = await fetch("/api/user?action=profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    telegramId: window.appUser.id,
    username: window.appUser.username
  })
});

  const data = await res.json();
  document.getElementById("balance").innerText = `Баланс: ${data.balance ?? 0} очков`;
}

async function loadReferrals() {
  const res = await fetch(`/api/referrals?action=list&telegramId=${window.appUser.id}`);
  const data = await res.json();

  document.getElementById("refCount").innerText =
    `Приглашено: ${data.count ?? 0}`;

  const list = document.getElementById("refList");
  list.innerHTML = "";

  (data.referrals ?? []).forEach(r => {
    const li = document.createElement("li");
    li.innerText = r.username ? `@${r.username}` : `Игрок ${r.id}`;
    list.appendChild(li);
  });

  if (!data.referrals || data.referrals.length === 0) {
    const li = document.createElement("li");
    li.innerText = "Пока нет приглашённых друзей";
    li.style.opacity = 0.6;
    list.appendChild(li);
  }
}

async function loadReferralTask() {
  const res = await fetch(`/api/referrals?action=task&telegramId=${window.appUser.id}`);
  const data = await res.json();

  document.getElementById("taskInfo").innerText =
    `Пригласи ${data.required} друзей (${data.current}/${data.required}) — награда ${data.reward}`;

  const claimBtn = document.getElementById("claimTask");
  claimBtn.style.display =
    data.completed || data.current < data.required ? "none" : "block";
}

// =====================
// GAME LOGIC (готовые сценарии)
// =====================
window.currentGameSession = null;

async function startGame(scenarioCode) {
  showScreen("game");

  const storyEl = document.getElementById("gameStory");
  const choicesEl = document.getElementById("gameChoices");

  storyEl.innerText = "⏳ Загружаем сюжет...";
  choicesEl.innerHTML = "";

  const res = await fetch("/api/game?action=start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      scenarioCode
    })
  });

  const data = await res.json();

  if (!res.ok) {
    storyEl.innerText = "❌ Ошибка запуска игры";
    return;
  }

  window.currentGameSession = data.sessionId;
  renderGameStep(data.story, data.choices);
}

function renderGameStep(story, choices) {
  const storyEl = document.getElementById("gameStory");
  const choicesEl = document.getElementById("gameChoices");

  storyEl.innerText = story;
  choicesEl.innerHTML = "";

  if (!choices || choices.length === 0) {
    const btn = document.createElement("button");
    btn.innerText = "🔁 Вернуться к играм";
    btn.onclick = () => showScreen("games");
    choicesEl.appendChild(btn);
    return;
  }

  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.innerText = choice.choice_text;
    btn.onclick = () => makeChoice(choice.id);
    choicesEl.appendChild(btn);
  });
}

async function makeChoice(choiceId) {
  const storyEl = document.getElementById("gameStory");
  const choicesEl = document.getElementById("gameChoices");

  storyEl.innerText = "⏳ Продолжаем...";
  choicesEl.innerHTML = "";

  const res = await fetch("/api/game?action=choice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      sessionId: window.currentGameSession,
      choiceId
    })
  });

  const data = await res.json();

  if (!res.ok) {
    storyEl.innerText = "❌ Ошибка шага";
    return;
  }

  renderGameStep(data.story, data.choices);
}

// =====================
// Buttons: Простая / Усложнённая / Реалистичная
// =====================
document.querySelectorAll("#screen-games .donate-card[data-game]").forEach(card => {
  card.onclick = () => startGame(card.dataset.game);
});

// кнопка Выйти из игры //
const exitGameBtn = document.getElementById("exitGame");
if (exitGameBtn) {
  exitGameBtn.onclick = () => {
    window.currentGameSession = null;
    showScreen("games");
  };
}

// =====================
// Claim referral task
// =====================
const claimBtn = document.getElementById("claimTask");

if (claimBtn) {
  claimBtn.onclick = async () => {
    try {
      const res = await fetch("/api/claim_referral_task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: window.appUser.id
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Ошибка получения награды");
        return;
      }

      alert("🎉 Награда получена!");
      loadUser();          // обновляем баланс
      loadReferralTask();  // обновляем задание
    } catch (e) {
      alert("Ошибка соединения");
    }
  };
}

async function loadLeaderboard() {
  const res = await fetch(`/api/leaderboard?telegramId=${window.appUser.id}`);
  const data = await res.json();

  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";

  (data.top ?? []).forEach(p => {
    const li = document.createElement("li");
    li.innerText = `${p.username || "Игрок"} — ${p.balance}`;
    list.appendChild(li);
  });

  document.getElementById("myPosition").innerText =
    data.position ? `📍 Твоя позиция: ${data.position}` : "—";
}

// =====================
// DONATE MODAL LOGIC
// =====================
const donateModal = document.getElementById("donateModal");
document.getElementById("donate").onclick = () =>
  donateModal.classList.remove("hidden");

document.getElementById("closeDonateModal").onclick = () =>
  donateModal.classList.add("hidden");

async function startDonate(type) {
  if (!connectedWallet) {
  alert("Сначала подключи TON-кошелёк");
  return;
  }

  const config = {
  unlock_games: {
    amount: 0.5,
    label: "unlock_games"
  },
  custom_scenarios: {
    amount: 0.5,
    label: "custom_scenarios"
  },
  support: {
    amount: 0.3,
    label: "support"
  }
};

  const selected = config[type];
  if (!selected) return;

  donateModal.classList.add("hidden");

  const initRes = await fetch("/api/donate?action=init", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    telegramId: window.appUser.id,
    amount: selected.amount,
    type: selected.label
  })
});

  const initData = await initRes.json();

  const tx = {
  validUntil: Math.floor(Date.now() / 1000) + 300,
  messages: [
  {
  address: "UQCsCSQGZTz4uz5KrQ-c-UZQgh3TaDBx7IM3MtQ1jHFjHSsQ",
  amount: (selected.amount * 1e9).toString()
  }
  ]
  };

  try {
  const result = await tonConnectUI.sendTransaction(tx);

  await fetch("/api/donate?action=confirm", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    donationId: initData.donationId,
    txHash: result.boc || "unknown"
  })
});

  alert("🙏 Спасибо за поддержку!");
  } catch {
  alert("Платёж отменён");
  }
}

// =====================
// Invite friends
// =====================
const inviteBtn = document.getElementById("invite");
if (inviteBtn) {
  inviteBtn.onclick = () => {
    const refLink = `https://t.me/MPquestoria_bot?start=${window.appUser.id}`;
    tg.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(refLink)}`
    );
  };
}

// =====================
// Init
// =====================
initTonConnect();
showScreen("home");
loadUser();
