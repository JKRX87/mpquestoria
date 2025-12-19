// ===== WebLLM (локальный ИИ) =====
let engine = null;
let llmReady = false;

async function initLLM() {
  if (llmReady) return;

  if (!window.webllm) {
    alert("WebLLM не загрузился. Проверь подключение скрипта.");
    return;
  }

  const { CreateMLCEngine } = window.webllm;

  engine = await CreateMLCEngine({
    model: "Phi-3-mini-4k-instruct-q4f16_1",
  });

  llmReady = true;
  console.log("✅ WebLLM готов");
}

async function generateTextLocal(userPrompt) {
  await initLLM();

  const systemPrompt = `
Ты — опытный мастер текстовых RPG.

Пиши ТОЛЬКО на русском языке.
Стиль: понятно, атмосферно, без лишней воды.

Ответ строго в JSON:
{
  "story": "2–4 предложения сюжета",
  "choices": [
    { "id": "a", "text": "Вариант действия 1" },
    { "id": "b", "text": "Вариант действия 2" },
    { "id": "c", "text": "Вариант действия 3" }
  ]
}
`;

  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
  });

  const raw = result.choices[0].message.content;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("❌ Ошибка JSON:", raw);
    return null;
  }
}

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
// Game state
// =====================
let pendingGameType = null;
let pendingSessionId = null;
let currentSessionId = null;

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
// Games logic (WebLLM only)
// =====================
document.querySelectorAll("#screen-games .donate-card").forEach(card => {
  card.onclick = () => startGame(card.dataset.game);
});

async function startGame(gameType) {
  showScreen("game");

  const storyEl = document.getElementById("gameStory");
  const choicesEl = document.getElementById("gameChoices");

  storyEl.innerText = "🧠 Загружаем ИИ... Это может занять до минуты.";
  choicesEl.innerHTML = "";

  const prompt = `
Начни новое текстовое RPG-приключение.
Тип игры: ${gameType}.
`;

  const data = await generateTextLocal(prompt);

  if (!data) {
    storyEl.innerText = "❌ Ошибка генерации сюжета.";
    return;
  }

  storyEl.innerText = data.story;

  data.choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.innerText = choice.text;

    btn.onclick = async () => {
      storyEl.innerText = "⏳ Думаем...";
      choicesEl.innerHTML = "";

      const next = await generateTextLocal(
        `Сюжет: ${data.story}\nИгрок выбрал: ${choice.text}`
      );

      if (!next) return;

      storyEl.innerText = next.story;

      next.choices.forEach(c => {
        const b = document.createElement("button");
        b.innerText = c.text;
        b.onclick = btn.onclick;
        choicesEl.appendChild(b);
      });
    };

    choicesEl.appendChild(btn);
  });
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
// Init
// =====================
initTonConnect();
showScreen("home");
loadUser();
