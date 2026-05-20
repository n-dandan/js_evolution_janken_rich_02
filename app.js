/* ── Evolution data ── */
const EVOLUTIONS = {
  rock: {
    label: "グー", icon: "✊",
    imgPrefix: "gu",
    stages: [
      { name: "石",             atk: 10   },
      { name: "鋼",             atk: 45   },
      { name: "ダイアモンド",   atk: 180  },
      { name: "神の感謝の正拳", atk: 9999 },
    ],
  },
  scissors: {
    label: "チョキ", icon: "✌",
    imgPrefix: "cho",
    stages: [
      { name: "ハサミ", atk: 12   },
      { name: "日本刀", atk: 50   },
      { name: "レーザーカッター", atk: 200  },
      { name: "悪魔の裁断",       atk: 9999 },
    ],
  },
  paper: {
    label: "パー", icon: "✋",
    imgPrefix: "par",
    stages: [
      { name: "紙",               atk: 8    },
      { name: "防弾チョッキ",     atk: 40   },
      { name: "カーボンファイバー", atk: 170  },
      { name: "女神の結界",       atk: 9999 },
    ],
  },
};

const SHAPES   = ["rock", "scissors", "paper"];
const MAX_TIER = 3;

const TIER_COLOR = ["#9a93b8", "#7adfff", "#c98cff", "#ffd66b"];
const TIER_LABEL = ["NORMAL", "RARE", "EPIC", "LEGENDARY"];

function imgPath(shape, tier) {
  return `img/${EVOLUTIONS[shape].imgPrefix}_lv${tier + 1}.png`;
}

function judge(a, b) {
  if (a === b) return 0;
  if (
    (a === "rock"     && b === "scissors") ||
    (a === "scissors" && b === "paper")    ||
    (a === "paper"    && b === "rock")
  ) return 1;
  return -1;
}

/* ── Game state ── */
let state = {
  playerShape:   "rock",
  computerShape: "paper",
  playerTier:    0,
  computerTier:  0,
  result:        "idle",
  round:         0,
  pScore:        0,
  cScore:        0,
  log:           [],
  reveal:        true,
  lastMove:      null,
  animating:     false,
  shuffling:     false,
};

/* ── Render helpers ── */

function renderPanel(panelEl, side, shape, tier, reveal, shuffling) {
  const data  = EVOLUTIONS[shape];
  const stage = data.stages[tier];
  const tierColor = TIER_COLOR[tier];
  const tierLabel = TIER_LABEL[tier];

  panelEl.dataset.tier = tier;

  // Identity
  panelEl.querySelector(".base-label").textContent = data.label;

  // Glyph box reveal/shuffle state
  const glyphBox = panelEl.querySelector(".glyph-box");
  glyphBox.classList.toggle("revealed", reveal);
  glyphBox.classList.toggle("shuffling", shuffling);

  // Glyph image
  const glyphImg = panelEl.querySelector(".glyph-img");
  glyphImg.src = imgPath(shape, tier);
  glyphImg.alt = stage.name;

  // Tier badge
  panelEl.querySelector(".tier-badge").textContent = `T${tier + 1}`;

  // Evolution name
  panelEl.querySelector(".evo-name").textContent = stage.name;

  // Level & tier label
  panelEl.querySelector(".level-value").textContent    = `Lv.${tier + 1}`;
  panelEl.querySelector(".tier-label-sub").textContent = tierLabel;

  // Attack
  panelEl.querySelector(".atk-value").textContent = stage.atk.toLocaleString();

  // Progress bar
  panelEl.querySelectorAll(".progress-seg").forEach((seg, i) => {
    seg.classList.toggle("active", i <= tier);
  });
  panelEl.querySelector(".progress-count").textContent = `${tier + 1}/4`;

  // Arsenal
  SHAPES.forEach(s => {
    const item      = panelEl.querySelector(`.arsenal-item[data-shape="${s}"]`);
    const ev        = EVOLUTIONS[s];
    const st        = ev.stages[tier];
    const isCurrent = s === shape;

    item.classList.toggle("active", isCurrent);
    item.style.background  = isCurrent ? `${tierColor}14` : "rgba(255,255,255,.025)";
    item.style.borderColor = isCurrent ? `${tierColor}55` : "rgba(255,255,255,.06)";

    const glEl = item.querySelector(".arsenal-glyph");
    glEl.src = imgPath(s, tier);
    glEl.alt = st.name;

    item.querySelector(".arsenal-name").textContent = st.name;
    item.querySelector(".arsenal-lv").textContent   = `Lv.${tier + 1}`;
  });
}

function renderResultBanner(result, round, pScore, cScore, lastMove) {
  const banner = document.getElementById("result-banner");
  banner.dataset.result = result;

  const config = {
    win:  { en: "WIN",   jp: "勝利", hint: "進化チャンス！" },
    lose: { en: "LOSE",  jp: "敗北", hint: "次は気をつけよう" },
    draw: { en: "DRAW",  jp: "引分", hint: "もう一度勝負" },
    idle: { en: "READY", jp: "待機", hint: "手を選択してください" },
  };
  const c = config[result] || config.idle;

  banner.querySelector(".verdict-en").textContent   = c.en;
  banner.querySelector(".verdict-jp").textContent   = c.jp;
  banner.querySelector(".verdict-hint").textContent = c.hint;

  document.getElementById("round-val").textContent = `#${String(round).padStart(2, "0")}`;
  document.getElementById("p-score").textContent   = pScore;
  document.getElementById("c-score").textContent   = cScore;

  const lastEl = document.getElementById("last-content");
  if (lastMove) {
    lastEl.innerHTML =
      `<span style="color:var(--player)">${lastMove.player.label}</span>` +
      `<span style="margin:0 10px;color:var(--ink-dim)">VS</span>` +
      `<span style="color:var(--computer)">${lastMove.computer.label}</span>`;
  } else {
    lastEl.innerHTML = `<span style="color:var(--ink-dim)">—</span>`;
  }
}

function renderChoiceButtons(playerShape, playerTier, disabled) {
  const tierColor = TIER_COLOR[playerTier];

  document.querySelectorAll(".choice-btn").forEach(btn => {
    const shape  = btn.dataset.shape;
    const stg    = EVOLUTIONS[shape].stages[playerTier];
    const active = shape === playerShape;

    btn.disabled = disabled;
    btn.classList.toggle("active", active);

    const badge = btn.querySelector(".btn-level-badge");
    badge.textContent  = `L${playerTier + 1}`;
    badge.style.border = `1px solid ${tierColor}`;
    badge.style.color  = tierColor;

    btn.querySelector(".btn-evo-name").textContent = stg.name;

    const lvBadge = btn.querySelector(".btn-lv-badge");
    lvBadge.textContent      = `Lv.${playerTier + 1}`;
    lvBadge.style.color      = tierColor;
    lvBadge.style.border     = `1px solid ${tierColor}55`;
    lvBadge.style.background = `${tierColor}11`;

    btn.querySelector(".btn-atk").textContent = `⚔ ${stg.atk.toLocaleString()}`;
  });
}

function renderLog(log) {
  const el = document.getElementById("log-entries");
  if (log.length === 0) {
    el.innerHTML = `<span class="dim">戦闘開始を待機中…</span>`;
    return;
  }
  el.innerHTML = log.slice(-5).map(l =>
    `<span class="log-${l.result}" style="margin-right:14px">${l.result.toUpperCase()}</span>`
  ).join("");
}

function render() {
  const { playerShape, computerShape, playerTier, computerTier,
          result, round, pScore, cScore, log, reveal, lastMove, animating, shuffling } = state;

  renderPanel(document.getElementById("computer-panel"), "computer", computerShape, computerTier, reveal, shuffling);
  renderPanel(document.getElementById("player-panel"),   "player",  playerShape,   playerTier,   reveal, false);
  renderResultBanner(result, round, pScore, cScore, lastMove);
  renderChoiceButtons(playerShape, playerTier, animating);
  renderLog(log);
}

/* ── Game logic ── */

function play(shape) {
  if (state.animating) return;
  state.animating = true;
  state.shuffling = true;
  state.reveal    = false;
  render();

  const cpuPick       = SHAPES[Math.floor(Math.random() * 3)];
  const computerPanel = document.getElementById("computer-panel");
  let tick = 0;
  const cycle = setInterval(() => {
    state.computerShape = SHAPES[tick % 3];
    tick++;
    renderPanel(computerPanel, "computer", state.computerShape, state.computerTier, false, true);
  }, 80);

  setTimeout(() => {
    clearInterval(cycle);

    state.shuffling     = false;
    state.computerShape = cpuPick;
    state.playerShape   = shape;
    state.reveal        = true;

    const verdict = judge(shape, cpuPick);
    const r = verdict === 0 ? "draw" : verdict === 1 ? "win" : "lose";

    state.result = r;
    state.round++;

    const prevPlayerTier   = state.playerTier;
    const prevComputerTier = state.computerTier;

    state.lastMove = {
      player:   { label: EVOLUTIONS[shape].stages[prevPlayerTier].name },
      computer: { label: EVOLUTIONS[cpuPick].stages[prevComputerTier].name },
    };

    if (r === "win") {
      state.playerTier = Math.min(MAX_TIER, prevPlayerTier + 1);
      state.pScore++;
    }
    if (r === "lose") {
      state.computerTier = Math.min(MAX_TIER, prevComputerTier + 1);
      state.cScore++;
    }

    state.log       = [...state.log, { result: r, p: shape, c: cpuPick }];
    state.animating = false;

    render();
  }, 480);
}

function reset() {
  state = {
    playerShape:   "rock",
    computerShape: "paper",
    playerTier:    0,
    computerTier:  0,
    result:        "idle",
    round:         0,
    pScore:        0,
    cScore:        0,
    log:           [],
    reveal:        true,
    lastMove:      null,
    animating:     false,
    shuffling:     false,
  };
  render();
}

/* ── Event listeners ── */
document.querySelectorAll(".choice-btn").forEach(btn => {
  btn.addEventListener("click", () => play(btn.dataset.shape));
});

document.getElementById("reset-btn").addEventListener("click", reset);

document.addEventListener("keydown", e => {
  if      (e.key === "1")               play("rock");
  else if (e.key === "2")               play("scissors");
  else if (e.key === "3")               play("paper");
  else if (e.key.toLowerCase() === "r") reset();
});

/* ── Initial render ── */
render();
