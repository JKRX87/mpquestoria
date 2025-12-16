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
  const res = await fetch("/api/user", {
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
  const res = await fetch(`/api/referrals?telegramId=${window.appUser.id}`);
  const data = await res.json();
  document.getElementById("refCount").innerText = `Приглашено: ${data.count ?? 0}`;
}

async function loadReferralTask() {
    const res = await fetch(`/api/referral_task?telegramId=${window.appUser.id}`);
  const data = await res.json();

  document.getElementById("taskInfo").innerText =
    `Пригласи ${data.required} друзей (${data.current}/${data.required}) — награда ${data.reward}`;

  const claimBtn = document.getElementById("claimTask");
  claimBtn.style.display =
    data.completed || data.current < data.required ? "none" : "block";
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
    games: { amount: 0.5, label: "unlock_games" },
    scenarios: { amount: 0.5, label: "unlock_scenarios" },
    support: { amount: 0.3, label: "support_project" }
  };

  const selected = config[type];
  if (!selected) return;

  donateModal.classList.add("hidden");

  const initRes = await fetch("/api/donate/init", {
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

    await fetch("/api/donate/confirm", {
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
