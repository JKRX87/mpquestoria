// =====================
// Telegram WebApp init
// =====================
function getTelegramWebApp() {
  if (window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

// =====================
// TON Connect
// =====================
let tonConnectUI = null;
let connectedWallet = null;

function initTonConnect() {
  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: "https://mpquestoria.vercel.app/tonconnect-manifest.json"
  });

  if (tonConnectUI.wallet) {
    connectedWallet = tonConnectUI.wallet;
    onWalletConnected(connectedWallet);
  }

  tonConnectUI.onStatusChange(wallet => {
    connectedWallet = wallet;
    if (wallet) onWalletConnected(wallet);
  });
}

async function onWalletConnected(wallet) {
  const address = wallet.account.address;

  document.getElementById("linkWallet").innerText = "🔗 Кошелёк подключён";

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
  document.getElementById("balance").innerText = `Баланс: ${data.balance ?? 0} очков`;
}

async function loadReferrals() {
  const res = await fetch(`/api/referrals?telegramId=${window.appUser.id}`);
  const data = await res.json();
  document.getElementById("refCount").innerText = `Приглашено: ${data.count}`;
  const list = document.getElementById("refList");
  list.innerHTML = "";
  data.referrals.forEach(r => {
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
  data.top.forEach(p => {
    const li = document.createElement("li");
    li.innerText = `${p.username || "Player"} — ${p.balance}`;
    list.appendChild(li);
  });
  document.getElementById("myPosition").innerText =
    data.position ? `📍 Твоя позиция: ${data.position}` : "—";
}

// =====================
// Buttons
// =====================
document.getElementById("linkWallet").onclick = async () => {
  if (!tonConnectUI) return;
  await tonConnectUI.openModal();
};

document.getElementById("donate").onclick = async () => {
  if (!connectedWallet) {
    alert("Сначала подключи TON-кошелёк");
    return;
  }

  const amountTon = 1;
  const tx = {
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: "ТВОЙ_TON_КОШЕЛЁК",
        amount: (amountTon * 1e9).toString()
      }
    ]
  };

  try {
    await tonConnectUI.sendTransaction(tx);

    await fetch("/api/donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: window.appUser.id,
        amount: amountTon
      })
    });

    alert("🙏 Спасибо за поддержку!");
    loadUser();
  } catch (e) {
    alert("Платёж отменён");
  }
};

// =====================
// Init
// =====================
window.addEventListener("DOMContentLoaded", async () => {
  const tg = getTelegramWebApp();
  if (!tg) {
    alert("❌ Открой приложение через Telegram");
    return;
  }

  tg.ready();

  const user = tg.initDataUnsafe.user;
  window.appUser = {
    id: user.id,
    username: user.username || user.first_name
  };

  initTonConnect();
  showScreen("home");
  loadUser();
});
