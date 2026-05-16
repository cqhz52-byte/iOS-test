const rows = 6;
const cols = 8;
const icons = ["🍎", "🍋", "🍇", "🥝", "🍒", "🍑", "🍍", "🥥", "🍉", "⭐", "🚀", "💎"];

const boardEl = document.querySelector("#board");
const pathLayer = document.querySelector("#pathLayer");
const timerEl = document.querySelector("#timer");
const remainingEl = document.querySelector("#remaining");
const messageEl = document.querySelector("#message");
const restartBtn = document.querySelector("#restart");
const installBtn = document.querySelector("#installApp");

let grid = [];
let selected = null;
let startedAt = Date.now();
let timerId = 0;
let remaining = 0;
let installPrompt = null;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildDeck() {
  const totalTiles = rows * cols;
  const pairs = totalTiles / 2;
  const deck = [];
  for (let i = 0; i < pairs; i += 1) {
    const icon = icons[i % icons.length];
    deck.push(icon, icon);
  }
  return shuffle(deck);
}

function resetGame() {
  const deck = buildDeck();
  grid = Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(null));

  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      grid[r][c] = deck.shift();
    }
  }

  selected = null;
  remaining = rows * cols;
  startedAt = Date.now();
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 500);
  updateTimer();
  renderBoard();
  clearPath();
  setMessage("点击两个相同图案，若能用不超过两个转角连接，就会消除。");
}

function updateTimer() {
  timerEl.textContent = formatTime(Date.now() - startedAt);
}

function renderBoard() {
  boardEl.innerHTML = "";
  remainingEl.textContent = remaining;

  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const button = document.createElement("button");
      button.className = "tile";
      button.type = "button";
      button.dataset.row = r;
      button.dataset.col = c;
      button.textContent = grid[r][c] ?? "";
      button.setAttribute("aria-label", grid[r][c] ? `图案 ${grid[r][c]}` : "空位");

      if (!grid[r][c]) {
        button.classList.add("empty");
      }

      if (selected && selected.r === r && selected.c === c) {
        button.classList.add("selected");
      }

      button.addEventListener("click", () => chooseTile(r, c));
      boardEl.appendChild(button);
    }
  }
}

function chooseTile(r, c) {
  if (!grid[r][c]) return;

  if (!selected) {
    selected = { r, c };
    setMessage("再选一个相同图案。");
    renderBoard();
    return;
  }

  if (selected.r === r && selected.c === c) {
    selected = null;
    setMessage("已取消选择。");
    renderBoard();
    return;
  }

  const first = selected;
  selected = null;

  if (grid[first.r][first.c] !== grid[r][c]) {
    setMessage("图案不同，换一对试试。");
    renderBoard();
    return;
  }

  const path = findPath(first, { r, c });
  if (!path) {
    setMessage("这两个暂时连不上。");
    renderBoard();
    return;
  }

  grid[first.r][first.c] = null;
  grid[r][c] = null;
  remaining -= 2;
  drawPath(path);
  setMessage(remaining === 0 ? "完成！你清空了整张棋盘。" : "配对成功。");
  renderBoard();

  if (remaining === 0) {
    clearInterval(timerId);
  }
}

function findPath(start, end) {
  const points = [
    start,
    ...allClearPoints().filter((point) => !(point.r === start.r && point.c === start.c)),
    end,
  ];

  for (const p1 of points) {
    if (!straightClear(start, p1)) continue;

    if (straightClear(p1, end)) {
      return compactPath([start, p1, end]);
    }

    for (const p2 of points) {
      if (!straightClear(p1, p2) || !straightClear(p2, end)) continue;
      return compactPath([start, p1, p2, end]);
    }
  }

  return null;
}

function allClearPoints() {
  const points = [];
  for (let r = 0; r <= rows + 1; r += 1) {
    for (let c = 0; c <= cols + 1; c += 1) {
      if (!grid[r][c]) points.push({ r, c });
    }
  }
  return points;
}

function straightClear(a, b) {
  if (a.r !== b.r && a.c !== b.c) return false;
  if (a.r === b.r && a.c === b.c) return true;

  if (a.r === b.r) {
    const from = Math.min(a.c, b.c) + 1;
    const to = Math.max(a.c, b.c);
    for (let c = from; c < to; c += 1) {
      if (grid[a.r][c]) return false;
    }
    return true;
  }

  const from = Math.min(a.r, b.r) + 1;
  const to = Math.max(a.r, b.r);
  for (let r = from; r < to; r += 1) {
    if (grid[r][a.c]) return false;
  }
  return true;
}

function compactPath(path) {
  return path.filter((point, index) => {
    const prev = path[index - 1];
    const next = path[index + 1];
    if (!prev || !next) return true;
    return !(prev.r === point.r && point.r === next.r) && !(prev.c === point.c && point.c === next.c);
  });
}

function drawPath(path) {
  clearPath();

  const boardRect = boardEl.getBoundingClientRect();
  const wrapRect = pathLayer.getBoundingClientRect();
  const tileWidth = boardRect.width / cols;
  const tileHeight = boardRect.height / rows;
  const gapX = (boardRect.width - tileWidth * cols) / Math.max(cols - 1, 1);
  const gapY = (boardRect.height - tileHeight * rows) / Math.max(rows - 1, 1);

  const points = path.map((point) => {
    const x = boardRect.left - wrapRect.left + (point.c - 1) * (tileWidth + gapX) + tileWidth / 2;
    const y = boardRect.top - wrapRect.top + (point.r - 1) * (tileHeight + gapY) + tileHeight / 2;
    return `${x},${y}`;
  });

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points.join(" "));
  pathLayer.appendChild(polyline);
  setTimeout(clearPath, 360);
}

function clearPath() {
  pathLayer.innerHTML = "";
}

function setMessage(text) {
  messageEl.textContent = text;
}

restartBtn.addEventListener("click", resetGame);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!installPrompt) return;
  installBtn.hidden = true;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installBtn.hidden = true;
  setMessage("已安装到桌面。");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      setMessage("离线缓存暂时不可用，游戏仍可正常游玩。");
    });
  });
}

resetGame();
