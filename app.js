/* ── Evolution data ── */
const EVOLUTIONS = {
  rock: {
    label: "グー", icon: "✊",
    imgPrefix: "gu",
    stages: [
      { name: "石" },
      { name: "鋼" },
      { name: "ダイアモンド" },
      { name: "神の感謝の正拳" },
    ],
  },
  scissors: {
    label: "チョキ", icon: "✌",
    imgPrefix: "cho",
    stages: [
      { name: "ハサミ" },
      { name: "日本刀" },
      { name: "レーザーカッター" },
      { name: "悪魔の裁断" },
    ],
  },
  paper: {
    label: "パー", icon: "✋",
    imgPrefix: "par",
    stages: [
      { name: "紙" },
      { name: "防弾チョッキ" },
      { name: "カーボンファイバー" },
      { name: "女神の結界" },
    ],
  },
};

const SHAPES   = ["rock", "scissors", "paper"];
const MAX_TIER = 3;

const TIER_COLOR = ["#9a93b8", "#7adfff", "#c98cff", "#ffd66b"];
const TIER_LABEL = ["NORMAL", "RARE", "EPIC", "LEGENDARY"];

const INIT_TIERS = () => ({ rock: 0, scissors: 0, paper: 0 });

/*
  ATK計算:
    Lv.1: 100 + rand(0~200)  MAX:200
    Lv.2: 200 + rand(0~200)  MAX:300
    Lv.3: 300 + rand(0~200)  MAX:400
    Lv.4: 400 + rand(0~200)  MAX:500
  じゃんけん勝者は x2
*/
function calcAtk(tier) {
  return (tier + 1) * 100 + Math.floor(Math.random() * 201);
}

function atkRange(tier) {
  const base = (tier + 1) * 100;
  return `${base}〜${base + 200}`;
}

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
  playerTiers:   INIT_TIERS(),   // shape別に個別管理
  computerTiers: INIT_TIERS(),
  result:        "idle",
  round:         0,
  pScore:        0,
  cScore:        0,
  log:           [],
  reveal:        true,
  lastMove:      null,
  lastBattle:    null,
  animating:     false,
  shuffling:     false,
};

/* ── Render helpers ── */

// tiers: { rock:n, scissors:n, paper:n } — shapeごとのtierオブジェクト
function renderPanel(panelEl, side, shape, tiers, reveal, shuffling, battleAtk = null) {
  const tier      = tiers[shape];          // 現在表示中のshapeのtier
  const data      = EVOLUTIONS[shape];
  const stage     = data.stages[tier];
  const tierColor = TIER_COLOR[tier];
  const tierLabel = TIER_LABEL[tier];

  // CSS tierカラー変数を現在のshapeのtierで制御
  panelEl.dataset.tier = tier;

  // Identity
  panelEl.querySelector(".base-label").textContent = data.label;

  // Glyph box
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

  // ATK: バトル結果があれば実数値、なければ期待レンジを表示
  const atkEl = panelEl.querySelector(".atk-value");
  if (battleAtk !== null) {
    atkEl.textContent = battleAtk.doubled
      ? `${battleAtk.value.toLocaleString()} ×2`
      : battleAtk.value.toLocaleString();
  } else {
    atkEl.textContent = atkRange(tier);
  }

  // Progress bar (現在shapeのtierで表示)
  panelEl.querySelectorAll(".progress-seg").forEach((seg, i) => {
    seg.classList.toggle("active", i <= tier);
  });
  panelEl.querySelector(".progress-count").textContent = `${tier + 1}/4`;

  // Arsenal: 各shapeが独自のtierを持つ
  SHAPES.forEach(s => {
    const item      = panelEl.querySelector(`.arsenal-item[data-shape="${s}"]`);
    const ev        = EVOLUTIONS[s];
    const sTier     = tiers[s];              // このshape固有のtier
    const st        = ev.stages[sTier];
    const sTierColor = TIER_COLOR[sTier];
    const isCurrent = s === shape;

    item.classList.toggle("active", isCurrent);
    item.style.background  = isCurrent ? `${tierColor}14` : "rgba(255,255,255,.025)";
    item.style.borderColor = isCurrent ? `${tierColor}55` : "rgba(255,255,255,.06)";

    // 画像はそのshape固有のtierで表示
    const glEl = item.querySelector(".arsenal-glyph");
    glEl.src = imgPath(s, sTier);
    glEl.alt = st.name;

    item.querySelector(".arsenal-name").textContent = st.name;

    // Lv表示はshape固有のtierで色も個別に設定
    const lvEl = item.querySelector(".arsenal-lv");
    lvEl.textContent  = `Lv.${sTier + 1}`;
    lvEl.style.color  = sTierColor;
  });
}

function renderResultBanner(result, round, pScore, cScore, lastMove) {
  const banner = document.getElementById("result-banner");
  banner.dataset.result = result;

  const config = {
    win:  { en: "WIN",   jp: "勝利", hint: "使った手が進化！" },
    lose: { en: "LOSE",  jp: "敗北", hint: "使った手がリセットされた…" },
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
    const fmt = (m) => {
      const badge = m.doubled
        ? ` <span style="color:var(--gold);font-size:10px;letter-spacing:.05em">[${m.atk} ×2]</span>`
        : ` <span style="color:var(--ink-dim);font-size:10px;letter-spacing:.05em">[${m.atk}]</span>`;
      return m.label + badge;
    };
    lastEl.innerHTML =
      `<span style="color:var(--player)">${fmt(lastMove.player)}</span>` +
      `<span style="margin:0 10px;color:var(--ink-dim)">VS</span>` +
      `<span style="color:var(--computer)">${fmt(lastMove.computer)}</span>`;
  } else {
    lastEl.innerHTML = `<span style="color:var(--ink-dim)">—</span>`;
  }
}

// 各ボタンはそのshape固有のtierを表示
function renderChoiceButtons(playerShape, playerTiers, disabled) {
  document.querySelectorAll(".choice-btn").forEach(btn => {
    const s      = btn.dataset.shape;
    const sTier  = playerTiers[s];
    const stage  = EVOLUTIONS[s].stages[sTier];
    const tColor = TIER_COLOR[sTier];
    const active = s === playerShape;

    btn.disabled = disabled;
    btn.classList.toggle("active", active);

    const badge = btn.querySelector(".btn-level-badge");
    badge.textContent  = `L${sTier + 1}`;
    badge.style.border = `1px solid ${tColor}`;
    badge.style.color  = tColor;

    btn.querySelector(".btn-evo-name").textContent = stage.name;

    const lvBadge = btn.querySelector(".btn-lv-badge");
    lvBadge.textContent      = `Lv.${sTier + 1}`;
    lvBadge.style.color      = tColor;
    lvBadge.style.border     = `1px solid ${tColor}55`;
    lvBadge.style.background = `${tColor}11`;

    btn.querySelector(".btn-atk").textContent = `⚔ ${atkRange(sTier)}`;
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
  const { playerShape, computerShape, playerTiers, computerTiers,
          result, round, pScore, cScore, log, reveal, lastMove,
          lastBattle, animating, shuffling } = state;

  const playerBattleAtk   = lastBattle ? { value: lastBattle.playerAtk,   doubled: lastBattle.playerDoubled }   : null;
  const computerBattleAtk = lastBattle ? { value: lastBattle.computerAtk, doubled: lastBattle.computerDoubled } : null;

  renderPanel(document.getElementById("computer-panel"), "computer", computerShape, computerTiers, reveal, shuffling, computerBattleAtk);
  renderPanel(document.getElementById("player-panel"),   "player",  playerShape,   playerTiers,   reveal, false,     playerBattleAtk);
  renderResultBanner(result, round, pScore, cScore, lastMove);
  renderChoiceButtons(playerShape, playerTiers, animating);
  renderLog(log);
}

/* ── Game logic ── */

function play(shape) {
  if (state.animating) return;
  state.animating  = true;
  state.shuffling  = true;
  state.reveal     = false;
  state.lastBattle = null;
  render();

  const cpuPick       = SHAPES[Math.floor(Math.random() * 3)];
  const computerPanel = document.getElementById("computer-panel");
  let tick = 0;
  const cycle = setInterval(() => {
    state.computerShape = SHAPES[tick % 3];
    tick++;
    renderPanel(computerPanel, "computer", state.computerShape, state.computerTiers, false, true);
  }, 80);

  setTimeout(() => {
    clearInterval(cycle);

    state.shuffling     = false;
    state.computerShape = cpuPick;
    state.playerShape   = shape;
    state.reveal        = true;

    // 使った手それぞれのtierを取得
    const prevPlayerTier   = state.playerTiers[shape];
    const prevComputerTier = state.computerTiers[cpuPick];

    // じゃんけん判定 (1=勝ち, 0=引き分け, -1=負け)
    const rps = judge(shape, cpuPick);

    // ATK計算: 勝者は×2
    const playerDoubled    = rps === 1;
    const computerDoubled  = rps === -1;
    const playerBaseAtk    = calcAtk(prevPlayerTier);
    const computerBaseAtk  = calcAtk(prevComputerTier);
    const playerFinalAtk   = playerDoubled   ? playerBaseAtk   * 2 : playerBaseAtk;
    const computerFinalAtk = computerDoubled ? computerBaseAtk * 2 : computerBaseAtk;

    // 最終ATKの大小で勝敗決定
    let r;
    if      (playerFinalAtk > computerFinalAtk) r = "win";
    else if (computerFinalAtk > playerFinalAtk) r = "lose";
    else                                         r = "draw";

    state.result = r;
    state.round++;

    state.lastBattle = {
      playerAtk:      playerFinalAtk,
      computerAtk:    computerFinalAtk,
      playerDoubled,
      computerDoubled,
    };

    state.lastMove = {
      player:   { label: EVOLUTIONS[shape].stages[prevPlayerTier].name,    atk: playerFinalAtk,   doubled: playerDoubled },
      computer: { label: EVOLUTIONS[cpuPick].stages[prevComputerTier].name, atk: computerFinalAtk, doubled: computerDoubled },
    };

    // 勝者: 使った手だけ tier+1
    // 敗者: 使った手だけ tier→0 リセット
    if (r === "win") {
      state.playerTiers[shape]   = Math.min(MAX_TIER, prevPlayerTier + 1);
      state.computerTiers[cpuPick] = 0;
      state.pScore++;
    } else if (r === "lose") {
      state.computerTiers[cpuPick] = Math.min(MAX_TIER, prevComputerTier + 1);
      state.playerTiers[shape]     = 0;
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
    playerTiers:   INIT_TIERS(),
    computerTiers: INIT_TIERS(),
    result:        "idle",
    round:         0,
    pScore:        0,
    cScore:        0,
    log:           [],
    reveal:        true,
    lastMove:      null,
    lastBattle:    null,
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
