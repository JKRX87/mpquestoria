// =====================
// Telegram wbbApp init
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
   await fetch("/api/user?action=wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      wallet: null
    })
  });
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
  if (name === "history") loadGameHistory();
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
    // 🔥 ВАЖНО: синхронизация кошелька
  if (data.wallet) {
    setWalletButtonConnected(data.wallet);
  } else {
    setWalletButtonDefault();
  }
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

function renderGameStep(story, choices) {
  const storyEl = document.getElementById("gameStory");
  const choicesEl = document.getElementById("gameChoices");

  storyEl.innerText = story || "";
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

  const res = await fetch("/api/game_v2?action=choice", {
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

  // всегда показываем шаг
  renderGameStep(data.story, data.choices || []);

  // модалки
  if (data.isEnd) {
    if (data.result === "fail") {
      setTimeout(showLoseModal, 400);
    }
    if (data.result === "win") {
      setTimeout(showWinModal, 400);
    }
  }
}

// =====================
// Game cards (start / resume)
// =====================
document.querySelectorAll("#screen-games .donate-card[data-game]").forEach(card => {
  card.onclick = async () => {
    const gameType = card.dataset.game;
    if (gameType === "history") return;

    const type =
      gameType === "simple_base" ? "basic" :
      gameType === "hard_base" ? "hard" :
      "realistic";

    const res = await fetch("/api/game_select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: window.appUser.id,
        type
      })
    });

    const data = await res.json();

    if (data.done) {
      alert("🎉 Ты прошёл все игры этого типа!");
      return;
    }

    if (data.resume) {
      startGameResume(
        data.sessionId,
        data.scenarioId,
        data.gameNumber,
        data.total
      );
    } else {
      startGameByScenarioId(
        data.scenarioId,
        data.gameNumber,
        data.total
      );
    }
  };
});

async function startGameResume(sessionId, scenarioId, gameNumber, total) {
  showScreen("game");

  window.currentGameSession = sessionId;
  window.currentScenarioId = scenarioId;
  window.currentGameNumber = gameNumber;
  window.currentTotal = total;

  document.getElementById("gameTitle").innerText =
    `🎮 Игра ${gameNumber} / ${total}`;

  const res = await fetch("/api/game_v2?action=resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      sessionId
    })
  });

  const data = await res.json();
  renderGameStep(data.story, data.choices);
}

async function startGameByScenarioId(scenarioId, gameNumber, total) {
  showScreen("game");

  window.currentScenarioId = scenarioId;
  window.currentGameNumber = gameNumber;
  window.currentTotal = total;

  document.getElementById("gameTitle").innerText =
    `🎮 Игра ${gameNumber} / ${total}`;

  const res = await fetch("/api/game_v2?action=start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      scenarioId
    })
  });

  const data = await res.json();

  window.currentGameSession = data.sessionId;
  renderGameStep(data.story, data.choices);
}

// =====================
// History card
// =====================
const historyCard = document.querySelector(
  '#screen-games .donate-card[data-game="history"]'
);

if (historyCard) {
  historyCard.onclick = () => {
    showScreen("history");
    loadGameHistory();
  };
}

// кнопка Выйти из игры //
const exitGameBtn = document.getElementById("exitGame");
if (exitGameBtn) {
  exitGameBtn.onclick = () => {
  window.currentGameSession = null;
  window.currentScenarioId = null;
  window.currentGameNumber = null;
  window.currentTotal = null;
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
// =====================
// DONATE CARD CLICK
// =====================
document
  .querySelectorAll("#donateModal .donate-card")
  .forEach(card => {
    card.onclick = () => {
      startDonate();
    };
  });

async function startDonate() {
  if (!connectedWallet) {
    alert("Сначала подключи TON-кошелёк");
    return;
  }

  const amount = 0.5;

  const initRes = await fetch("/api/donate?action=init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      amount,
      type: "unlock"
    })
  });

  const initData = await initRes.json();

  const tx = {
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: "UQCsCSQGZTz4uz5KrQ-c-UZQgh3TaDBx7IM3MtQ1jHFjHSsQ",
        amount: (amount * 1e9).toString()
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
    const refLink =
      `https://t.me/MPquestoria_bot?start=ref_${window.appUser.id}`;
    tg.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(refLink)}`
    );
  };
}

// =====================
// Game progress logic
// =====================

async function loadGameHistory() {
  const res = 
    await fetch(`/api/gamehistory?telegramId=${window.appUser.id}`
  );
  const data = await res.json();

  const list = document.getElementById("gameHistory");
  list.innerHTML = "";

  if (!data.games || data.games.length === 0) {
    list.innerHTML = "<li>Побед пока нет</li>";
    return;
  }

  // 1. группируем по типу
  const groups = {
    basic: [],
    hard: [],
    realistic: []
  };

  data.games.forEach(g => {
    if (groups[g.scenario.type]) {
      groups[g.scenario.type].push(g);
    }
  });

  // 2. порядок и названия блоков
  const sections = [
    { type: "basic", title: "🟦 Базовые игры" },
    { type: "hard", title: "🟥 Усложнённые игры" },
    { type: "realistic", title: "🟩 Реалистичные игры" }
  ];

  // 3. рендер
  sections.forEach(section => {
    const games = groups[section.type];
    if (games.length === 0) return;

    const header = document.createElement("h3");
    header.innerText = section.title;
    list.appendChild(header);

    const ul = document.createElement("ul");

    games.forEach(g => {
      const li = document.createElement("li");

      li.innerText =
        `🏆 Сюжет №${g.scenario.game_number} — ${g.scenario.title}`;

      li.style.cursor = "pointer";
      li.onclick = () => openReplay(g.id);

      ul.appendChild(li);
    });

    list.appendChild(ul);
  });
}


async function openReplay(sessionId) {
  const res = await fetch(`/api/gamereplay?sessionId=${sessionId}`);
  const data = await res.json();

  if (!res.ok) {
    alert("Не удалось загрузить историю");
    return;
  }

  const typeLabel =
  data.type === "basic" ? "Базовая" :
  data.type === "hard" ? "Усложнённая" :
  data.type === "realistic" ? "Реалистичная" :
  "Игра";

document.getElementById("replayTitle").innerText =
  `📖 ${typeLabel} игра №${data.gameNumber} — ${data.scenario}`;


  document.getElementById("replayMeta").innerText =
    `Результат: ${data.result === "win" ? "🏆 Победа" : "❌ Поражение"}
     • ${new Date(data.createdAt).toLocaleDateString()}`;

  const container = document.getElementById("replayContent");
  container.innerHTML = "";

  data.replay.forEach(item => {
    const div = document.createElement("div");

    if (item.type === "story") {
      div.className = "replay-step";
      div.innerHTML = item.text;
    }

    if (item.type === "choice") {
      div.className = "replay-choice";
      div.innerHTML = `➡ ${item.text}`;
    }

    container.appendChild(div);
  });

  showScreen("replay");
}

function showLoseModal() {
  document.getElementById("loseModal").classList.remove("hidden");
}

document.getElementById("retrySame").onclick = () => {
  document.getElementById("loseModal").classList.add("hidden");
  startGameByScenarioId(
    window.currentScenarioId,
    window.currentGameNumber,
    window.currentTotal
  );
};

document.getElementById("newRandom").onclick = () => {
  document.getElementById("loseModal").classList.add("hidden");
  showScreen("games");
};

function showWinModal() {
  window.currentGameSession = null;
  document.getElementById("winModal").classList.remove("hidden");
}
document.getElementById("winNewGame").onclick = () => {
  document.getElementById("winModal").classList.add("hidden");
  showScreen("games");
};

document.getElementById("winToGames").onclick = () => {
  document.getElementById("winModal").classList.add("hidden");
  showScreen("games");
};

// =====================
// Init
// =====================
initTonConnect();
showScreen("home");
//loadUser();
