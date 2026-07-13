// 리더보드 1위 등극 연출 — 화면 가운데서 확대되며 나타났다 사라지는 오버레이
const IMG_SRC = "/assets/img/game_victory.png";

// 게임오버 순간 바로 뜨도록 미리 받아둔다 (1.7MB)
const preload = new Image();
preload.src = IMG_SRC;

export function showVictory() {
  const el = document.createElement("div");
  el.className = "victory-overlay";
  el.innerHTML = `
    <img src="${IMG_SRC}" alt="">
    <p>최고 기록 달성!</p>`;
  document.body.appendChild(el);
  el.addEventListener("animationend", (e) => {
    if (e.target === el) el.remove();
  });
}
