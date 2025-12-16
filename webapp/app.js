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

const user = tg.initDataUnsafe.user;
window.appUser = {
  id: user.id,
  username: user.username || user.first_name
};

// =====================
// TON Connect
// =====================
let tonConnectUI = null;
let connectedWallet = null;

const walletButton = document.getElementById("linkWallet");

// helpers
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
  if (!window.TON_CONNECT_UI) {
    console.error("TON_CONNECT_UI не загружен");
    return;
  }

  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: `${window.location.origin}/webapp/tonconnect-manifest.json`
  });

  if (tonConnectUI.wallet) {
    connectedWallet = tonConnectUI.wallet;
    onWalletConnected(connectedWallet);
  }

  tonConnectUI.onStatusChange(wallet => {
    connectedWallet = wallet;
    if (wallet) {
      onWalletConnected(wallet);
    } else {
      setWalletButtonDefault();
    }
  });

  console.log("✅ TON Connect инициализирован");
}

async function onWalletConnected(wallet) {
  const address = wallet.account.address;
  setWalletButtonConnected(address);

  await fetch("/api/wallet", {
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
const closeWalletModal = document.getElementById("closeWalletModal");
const disconnectWallet = document.getElementById("disconnectWallet");
const reconnectWallet = document.getElementById("reconnectWallet");

walletButton.onclick = async () => {
  if (!tonConnectUI) return;

  if (!connectedWallet) {
    await tonConnectUI.openModal();
  } else {
    walletModal.classList.remove("hidden");
  }
};

closeWalletModal.onclick = () => {
  walletModal.classList.add("hidden");
};

reconnectWallet.onclick = async () => {
  walletModal.classList.add("hidden");
  await tonConnectUI.openModal();
};

disconnectWallet.onclick = async () => {
  await fetch("/api/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      wallet: null
    })
  });

  await tonConnectUI.disconnect();
  connectedWallet = null;
  setWalletButtonDefault();
  walletModal.classList.add("hidden");
};

// =====================
// Screens
// =====================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));

  document.getElementById(`screen-${name}`)?.classList.add("active");
  document.querySelector(`.bottom-nav button[data-screen="${name}"]`)?.classList.add("active");

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
// API
// =====================
async function loadUser() {
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
}

async function loadReferrals() {
  const res = await fetch(`/api/referrals?telegramId=${window.appUser.id}`);
  const data = await res.json();

  document.getElementById("refCount").innerText =
    `Приглашено: ${data.count ?? 0}`;

  const list = document.getElementById("refList");
  list.innerHTML = "";

  (data.referrals ?? []).forEach(r => {
    const li = document.createElement("li");
    li.innerText = r.username || `Игрок ${r.id}`;
    list.appendChild(li);
  });
}

async function loadReferralTask() {
  const res = await fetch(`/api/referral_task?telegramId=${window.appUser.id}`);
  const data = await res.json();

  document.getElementById("taskInfo").innerText =
    `Пригласи ${data.required} друзей (${data.current}/${data.required}) — награда ${data.reward}`;

  document.getElementById("claimTask").style.display =
    data.completed || data.current < data.required ? "none" : "block";
}

async function loadLeaderboard() {
  const res = await fetch(`/api/leaderboard?telegramId=${window.appUser.id}`);
  const data = await res.json();

  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";

  (data.top ?? []).forEach(p => {
    const li = document.createElement("li");
    li.innerText = `${p.username || "Player"} — ${p.balance}`;
    list.appendChild(li);
  });

  document.getElementById("myPosition").innerText =
    data.position ? `📍 Твоя позиция: ${data.position}` : "—";
}

// =====================
// Donate
// =====================
document.getElementById("donate").onclick = async () => {
  if (!connectedWallet) {
    alert("Сначала подключи TON-кошелёк");
    return;
  }

  const amountTon = 1;

  // 1. Создаём pending донат
  const initRes = await fetch("/api/donate/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramId: window.appUser.id,
      amount: amountTon
    })
  });

  const initData = await initRes.json();
  if (!initData.donationId) {
    alert("Ошибка создания доната");
    return;
  }

  // 2. Отправляем транзакцию
  const tx = {
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: "UQCsCSQGZTz4uz5KrQ-c-UZQgh3TaDBx7IM3MtQ1jHFjHSsQ", // ТВОЙ TON АДРЕС
        amount: (amountTon * 1e9).toString()
      }
    ]
  };

  try {
    const result = await tonConnectUI.sendTransaction(tx);

    // 3. Подтверждаем донат
    await fetch("/api/donate/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donationId: initData.donationId,
        txHash: result.boc || "unknown"
      })
    });

    alert("🙏 Спасибо за поддержку!");
    loadUser();
  } catch {
    alert("Платёж отменён");
  }
};
// =====================
// Init
// =====================
initTonConnect();
showScreen("home");
loadUser();
