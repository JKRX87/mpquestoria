const tg = window.Telegram.WebApp;
tg.ready();

const user = tg.initDataUnsafe?.user;

async function loadUser() {
  if (!user) {
    alert("Не удалось получить данные пользователя");
    return;
  }

  const response = await fetch("/api/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      telegramId: user.id,
      username: user.username
    })
  });

  const data = await response.json();

  document.getElementById("balance").innerText =
    `Баланс: ${data.balance} очков`;
}

loadUser();

document.getElementById("play").onclick = () => {
  alert("Скоро здесь начнётся квест 🚀");
};
