// =====================
// WebLLM init
// =====================
let llmEngine = null;
let llmReady = false;

async function initLLM() {
  if (llmReady) return;

  const { CreateMLCEngine } = window.webllm;

  llmEngine = await CreateMLCEngine({
    model: "Llama-3.2-1B-Instruct-q4f16_1",
    temperature: 0.9
  });

  llmReady = true;
}

async function generateTextLocal(prompt) {
  await initLLM();

  const result = await llmEngine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500
  });

  return result.choices[0].message.content;
}

// =====================
// Telegram WebApp init
// =====================
function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

const tg = getTelegramWebApp();
if (!tg) {
  alert("❌ Открой приложение через Telegram");
  throw new Error("Telegram WebApp not found");
}
tg.ready();

const user = tg.initDataUnsafe?.user;

if (!user || !user.id) {
  alert("❌ Не удалось получить данные пользователя Telegram. Закрой и открой приложение заново.");
  throw new Error("Telegram user not found");
}

window.appUser = {
  id: Number(user.id),
  username: user.username || user.first_name || "Player"
};

// =====================
// Game state
// =====================
let pendingGameType = null;
let pendingSessionId = null;

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

document.querySelectorAll(".donate-card").forEach(card => {
  card.onclick = () => startDonate(card.dataset.type);
});

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
// Games logic
// =====================
document.querySelectorAll("#screen-games .donate-card").forEach(card => {
  card.onclick = () => handleGameClick(card.dataset.game);
});

async function handleGameClick(type) {
  if (type === "history") {
    alert("📜 История игр будет здесь");
    return;
  }

  pendingGameType = type;
  startGame(type);
}

function mapGameType(type) {
  if (type.startsWith("simple")) return "simple";
  if (type.startsWith("hard")) return "advanced";
  if (type.startsWith("real")) return "realistic";
  return "simple";
}

async function startGame(type) {
  try {
    // 1. Генерируем интро локально
    const raw = await generateTextLocal(`
Ты генератор интерактивных историй.

Создай интро и верни СТРОГО JSON:
{
  "title": "...",
  "setting": "...",
  "role": "...",
  "goal": "..."
}
    `);

    let intro;
    try {
      intro = JSON.parse(raw);
    } catch {
      intro = {
        title: "Неизвестная история",
        setting: "Фэнтези мир",
        role: "Герой",
        goal: "Выжить"
      };
    }

    // 2. Отправляем готовое интро на сервер
    const res = await fetch("/api/game?action=start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: window.appUser.id,
        gameType: mapGameType(type),
        gameMode: type.includes("custom") ? "custom" : "basic",
        intro
      })
    });

    const data = await res.json();

    currentSessionId = data.sessionId;
    document.getElementById("gameTitle").innerText = intro.title;

    openGameScreen();
    await loadNextStep();

  } catch (e) {
    console.error(e);
    alert("Ошибка запуска игры");
  }
}

// =====================
// Resume modal
// =====================
document.getElementById("resumeYes").onclick = () => {
  document.getElementById("resumeModal").classList.add("hidden");
  alert(`▶ Продолжаем игру ${pendingSessionId}`);
};

document.getElementById("resumeNo").onclick = async () => {
  document.getElementById("resumeModal").classList.add("hidden");

  await fetch("/api/game?action=abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id
    })
  });

  startGame(pendingGameType);
};

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
// Game runtime
// =====================
let currentSessionId = null;

function openGameScreen() {
  showScreen("game");
}

document.getElementById("exitGame").onclick = () => {
  showScreen("games");
};

// =====================
// Start / Resume game
// =====================
async function resumeGame(sessionId) {
  currentSessionId = sessionId;
  openGameScreen();
  await loadNextStep();
}

// обновляем обработчики из прошлого шага
document.getElementById("resumeYes").onclick = () => {
  document.getElementById("resumeModal").classList.add("hidden");
  resumeGame(pendingSessionId);
};

document.getElementById("resumeNo").onclick = async () => {
  document.getElementById("resumeModal").classList.add("hidden");

  await fetch("/api/game?action=abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: window.appUser.id })
  });

  startGame(pendingGameType);
};

// =====================
// Load game step
// =====================
async function loadNextStep(choice = null) {
  const raw = await generateTextLocal(`
Ты продолжаешь интерактивную историю.
Не повторяй события.

Формат:
STORY:
...
CHOICES:
1. ...
2. ...
3. ...
  `);

  const [storyRaw, choicesRaw] = raw.split("CHOICES:");
  const story = storyRaw.replace("STORY:", "").trim();

  const choices = choicesRaw
    ?.trim()
    .split("\n")
    .map(t => t.replace(/^\d+\.\s*/, ""));

  document.getElementById("gameStory").innerText = story;
  renderChoices(
    (choices || []).map((t, i) => ({ id: i + 1, text: t }))
  );
}

  if (data.finished) {
    document.getElementById("gameChoices").innerHTML =
      "<p>🏁 Игра завершена</p>";
  }

function renderChoices(choices) {
  const box = document.getElementById("gameChoices");
  box.innerHTML = "";

  choices.forEach(c => {
    const btn = document.createElement("button");
    btn.innerText = c.text;
    btn.onclick = () => loadNextStep(c.id);
    box.appendChild(btn);
  });
}

// =====================
// Init
// =====================
initTonConnect();
showScreen("home");
loadUser();
