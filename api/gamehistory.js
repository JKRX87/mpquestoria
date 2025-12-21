async function loadGameHistory() {
  const res = await fetch(
    `/api/gamehistory?telegramId=${window.appUser.id}`
  );
  const data = await res.json();

  const list = document.getElementById("gameHistory");
  list.innerHTML = "";

  if (!data.games.length) {
    list.innerHTML = "<li>Побед пока нет</li>";
    return;
  }

  data.games.forEach(g => {
    const li = document.createElement("li");
    li.innerText = `🏆 ${g.scenario.title} — ${new Date(g.created_at).toLocaleDateString()}`;
    list.appendChild(li);
  });
}
