// ═══════════════════════════════════════════════
//  GrowFocus — script.js
//  Live tree grows in sync with Pomodoro timer
// ═══════════════════════════════════════════════

// ── STATE ────────────────────────────────────────
const state = {
  timeLeft:       1500,   // seconds remaining
  totalTime:      1500,   // total seconds for current mode
  mode:           'focus',
  running:        false,
  interval:       null,
  sessions:       0,
  totalFocusSec:  0,
  treesGrown:     0,
  streak:         0,
  pomodoroCount:  0,      // 0–4 within a pomodoro set
};

// ── TREE GROWTH STAGES ───────────────────────────
// Each stage activates at a % of session progress
// 0% → Seed, 20% → Sprout, 45% → Sapling, 70% → Young, 100% → Full
const STAGES = [
  { id: 'stageSeed',    threshold: 0,    label: '🌰 Seed',      name: 'Seed'    },
  { id: 'stageSprout',  threshold: 0.20, label: '🌱 Sprout',    name: 'Sprout'  },
  { id: 'stageSapling', threshold: 0.45, label: '🌿 Sapling',   name: 'Sapling' },
  { id: 'stageYoung',   threshold: 0.70, label: '🌳 Young Tree', name: 'Young'  },
  { id: 'stageFull',    threshold: 1.00, label: '🌲 Full Tree',  name: 'Full Tree' },
];

let currentStageIndex = 0;

// ── DOM REFERENCES ────────────────────────────────
const timerDisplay  = document.getElementById('timerDisplay');
const modeLabel     = document.getElementById('modeLabel');
const startBtn      = document.getElementById('startBtn');
const resetBtn      = document.getElementById('resetBtn');
const ringProgress  = document.getElementById('ringProgress');
const gardenGround  = document.getElementById('gardenGround');
const gardenEmpty   = document.getElementById('gardenEmpty');
const gardenCount   = document.getElementById('gardenCount');
const rainContainer = document.getElementById('rainContainer');
const toast         = document.getElementById('toast');
const toastTitle    = document.getElementById('toastTitle');
const toastMsg      = document.getElementById('toastMsg');
const sessionsCount = document.getElementById('sessionsCount');
const focusTimeEl   = document.getElementById('focusTime');
const plantsCount   = document.getElementById('plantsCount');
const streakCount   = document.getElementById('streakCount');
const growthBadge   = document.getElementById('growthBadge');
const growthBarFill = document.getElementById('growthBarFill');
const stageLabel    = document.getElementById('stageLabel');
const dots          = document.querySelectorAll('.pom-dot');

const CIRC = 2 * Math.PI * 100; // SVG ring circumference ≈ 628

// ── MODE TABS ────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (state.running) return; // Don't allow mode change while running
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    state.mode      = tab.dataset.mode;
    state.timeLeft  = parseInt(tab.dataset.duration);
    state.totalTime = state.timeLeft;

    updateDisplay();
    updateRing();
    updateModeLabel();
    updateBodyTheme();

    // Reset tree to seed when mode manually changed
    if (state.mode === 'focus') {
      resetTreeToSeed();
    }
  });
});

// ── START / PAUSE ─────────────────────────────────
startBtn.addEventListener('click', () => {
  if (state.running) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener('click', resetTimer);
document.getElementById('clearGarden').addEventListener('click', clearGarden);

// ── TIMER FUNCTIONS ───────────────────────────────

function startTimer() {
  state.running = true;
  startBtn.textContent = 'Pause';

  if (state.mode === 'focus') {
    growthBadge.textContent = 'Growing...';
    growthBadge.classList.add('active');
    growthBadge.classList.remove('complete');
  }

  state.interval = setInterval(() => {
    if (state.timeLeft <= 0) {
      clearInterval(state.interval);
      onSessionComplete();
      return;
    }

    state.timeLeft--;

    if (state.mode === 'focus') {
      state.totalFocusSec++;
    }

    updateDisplay();
    updateRing();

    if (state.mode === 'focus') {
      updateLiveTree();
    }

  }, 1000);
}

function pauseTimer() {
  state.running = false;
  startBtn.textContent = 'Resume';
  clearInterval(state.interval);

  if (state.mode === 'focus') {
    growthBadge.textContent = 'Paused';
    growthBadge.classList.remove('active');
  }
}

function resetTimer() {
  clearInterval(state.interval);
  state.running = false;
  startBtn.textContent = 'Start';

  const active = document.querySelector('.mode-tab.active');
  state.timeLeft  = parseInt(active.dataset.duration);
  state.totalTime = state.timeLeft;

  updateDisplay();
  updateRing();
  stopRain();

  if (state.mode === 'focus') {
    resetTreeToSeed();
    growthBadge.textContent = 'Waiting...';
    growthBadge.classList.remove('active', 'complete');
  }
}

function onSessionComplete() {
  state.running = false;
  startBtn.textContent = 'Start';

  playChime();

  if (state.mode === 'focus') {
    state.sessions++;
    state.pomodoroCount = (state.pomodoroCount % 4) + 1;
    state.streak = Math.max(state.streak, state.pomodoroCount);

    // Show full tree
    showStage(4); // index 4 = stageFull
    growthBarFill.style.width = '100%';
    stageLabel.textContent = '🌲 Full Tree — Complete!';
    growthBadge.textContent = '✓ Complete!';
    growthBadge.classList.remove('active');
    growthBadge.classList.add('complete');

    // Add tree to garden after brief celebration delay
    setTimeout(() => {
      addTreeToGarden();
      updateDots();
      showToast('🌲 Tree Fully Grown!', `Session #${state.sessions} complete. Your tree is in the forest!`);
    }, 800);

    // Auto switch to break after toast
    setTimeout(() => {
      if (state.pomodoroCount >= 4) {
        switchToMode('long');
      } else {
        switchToMode('short');
      }
    }, 2200);

  } else {
    // Break ended
    stopRain();
    showToast('✅ Break Over!', 'Time to grow your next tree!');
    setTimeout(() => switchToMode('focus'), 1600);
  }

  updateStats();
}

// ── LIVE TREE GROWTH (synced to timer) ───────────────
// progress = 0 (start) → 1 (end of session)
function updateLiveTree() {
  const elapsed  = state.totalTime - state.timeLeft;
  const progress = elapsed / state.totalTime; // 0 → 1

  // Update growth bar
  growthBarFill.style.width = `${progress * 100}%`;

  // Find which stage we should currently be showing
  // We show the HIGHEST stage whose threshold has been passed
  let targetStageIndex = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i].threshold) {
      targetStageIndex = i;
      break;
    }
  }

  // Only update if stage changed to avoid re-triggering transitions
  if (targetStageIndex !== currentStageIndex) {
    currentStageIndex = targetStageIndex;
    showStage(currentStageIndex);
    stageLabel.textContent = STAGES[currentStageIndex].label;
  }
}

function showStage(index) {
  STAGES.forEach((stage, i) => {
    const el = document.getElementById(stage.id);
    if (!el) return;
    if (i === index) {
      el.style.opacity = '1';
      el.style.transition = 'opacity 0.9s ease';
    } else {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.6s ease';
    }
  });
}

function resetTreeToSeed() {
  currentStageIndex = 0;
  growthBarFill.style.width = '0%';
  stageLabel.textContent = STAGES[0].label;

  // Show only seed
  STAGES.forEach((stage, i) => {
    const el = document.getElementById(stage.id);
    if (!el) return;
    el.style.opacity = i === 0 ? '1' : '0';
    el.style.transition = 'opacity 0.5s ease';
  });
}

// ── SWITCH MODE ───────────────────────────────────
function switchToMode(mode) {
  const tab = document.querySelector(`[data-mode="${mode}"]`);
  if (!tab) return;

  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  state.mode      = mode;
  state.timeLeft  = parseInt(tab.dataset.duration);
  state.totalTime = state.timeLeft;

  updateDisplay();
  updateRing();
  updateModeLabel();
  updateBodyTheme();

  if (mode === 'long') {
    startRain();
  }

  if (mode === 'focus') {
    resetTreeToSeed();
    growthBadge.textContent = 'Waiting...';
    growthBadge.classList.remove('active', 'complete');
  }
}

// ── DISPLAY HELPERS ───────────────────────────────

function updateDisplay() {
  const m = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
  const s = (state.timeLeft % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;
}

function updateRing() {
  const pct = state.timeLeft / state.totalTime;
  ringProgress.style.strokeDashoffset = CIRC * (1 - pct);
}

function updateModeLabel() {
  const labels = { focus: 'Focus Time', short: 'Short Break', long: 'Long Break' };
  modeLabel.textContent = labels[state.mode] || 'Focus Time';
}

function updateBodyTheme() {
  if (state.mode === 'focus') {
    document.body.classList.remove('break-mode');
  } else {
    document.body.classList.add('break-mode');
  }
}

function updateStats() {
  sessionsCount.textContent = state.sessions;
  const mins = Math.floor(state.totalFocusSec / 60);
  focusTimeEl.textContent = mins >= 60
    ? `${Math.floor(mins / 60)}h${mins % 60}m`
    : `${mins}m`;
  plantsCount.textContent  = state.treesGrown;
  streakCount.textContent  = state.streak;
}

function updateDots() {
  const filled = state.pomodoroCount % 4 === 0 && state.pomodoroCount > 0 ? 4 : state.pomodoroCount % 4;
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < filled);
  });
}

// ── GARDEN: ADD MINI TREE ─────────────────────────
function addTreeToGarden() {
  state.treesGrown++;

  // Build a small SVG mini-tree for the forest
  const wrapper = document.createElement('div');
  wrapper.classList.add('mini-tree');

  // Vary size slightly for natural feel
  const scale = 0.28 + Math.random() * 0.08;
  const hue   = Math.floor(Math.random() * 20) - 10; // slight hue variation

  wrapper.innerHTML = `
    <svg viewBox="0 0 280 260"
         width="${Math.round(280 * scale)}"
         height="${Math.round(260 * scale)}"
         xmlns="http://www.w3.org/2000/svg"
         style="filter: hue-rotate(${hue}deg) drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
      <ellipse cx="140" cy="248" rx="90" ry="8" fill="rgba(93,186,111,0.1)"/>
      <line x1="133" y1="242" x2="108" y2="252" stroke="#5a3010" stroke-width="4" stroke-linecap="round"/>
      <line x1="147" y1="242" x2="172" y2="252" stroke="#5a3010" stroke-width="4" stroke-linecap="round"/>
      <rect x="130" y="182" width="20" height="62" rx="7" fill="#7c4a1e"/>
      <rect x="133" y="182" width="7" height="62" rx="4" fill="#a0622a" opacity="0.45"/>
      <line x1="140" y1="210" x2="96" y2="185" stroke="#6b3e18" stroke-width="7" stroke-linecap="round"/>
      <line x1="140" y1="204" x2="184" y2="178" stroke="#6b3e18" stroke-width="7" stroke-linecap="round"/>
      <line x1="140" y1="198" x2="140" y2="168" stroke="#6b3e18" stroke-width="6" stroke-linecap="round"/>
      <line x1="96" y1="185" x2="78" y2="168" stroke="#7c4a1e" stroke-width="4" stroke-linecap="round"/>
      <line x1="96" y1="185" x2="112" y2="168" stroke="#7c4a1e" stroke-width="4" stroke-linecap="round"/>
      <line x1="184" y1="178" x2="200" y2="162" stroke="#7c4a1e" stroke-width="4" stroke-linecap="round"/>
      <line x1="184" y1="178" x2="168" y2="162" stroke="#7c4a1e" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="140" cy="165" rx="72" ry="58" fill="#2d7a3e"/>
      <ellipse cx="90" cy="170" rx="30" ry="25" fill="#3d9e52"/>
      <ellipse cx="190" cy="162" rx="30" ry="25" fill="#3d9e52"/>
      <ellipse cx="140" cy="148" rx="50" ry="40" fill="#3d9e52"/>
      <ellipse cx="78" cy="160" rx="22" ry="18" fill="#4aae60"/>
      <ellipse cx="200" cy="153" rx="22" ry="18" fill="#4aae60"/>
      <ellipse cx="115" cy="140" rx="28" ry="22" fill="#52b86a"/>
      <ellipse cx="165" cy="138" rx="28" ry="22" fill="#52b86a"/>
      <ellipse cx="140" cy="128" rx="36" ry="28" fill="#5dba6f"/>
      <ellipse cx="128" cy="118" rx="18" ry="14" fill="#6dce80"/>
      <ellipse cx="155" cy="120" rx="16" ry="13" fill="#6dce80"/>
      <ellipse cx="140" cy="110" rx="14" ry="11" fill="#7de08f"/>
      <ellipse cx="133" cy="106" rx="6" ry="5" fill="#a8f0b8" opacity="0.6"/>
      <circle cx="102" cy="152" r="4" fill="#f87171" opacity="0.8"/>
      <circle cx="176" cy="145" r="4" fill="#f87171" opacity="0.8"/>
      <circle cx="118" cy="128" r="3" fill="#fcd34d" opacity="0.9"/>
      <circle cx="162" cy="126" r="3" fill="#fcd34d" opacity="0.9"/>
    </svg>
  `;

  gardenGround.appendChild(wrapper);
  gardenEmpty.style.display = 'none';
  gardenCount.textContent = `${state.treesGrown} tree${state.treesGrown !== 1 ? 's' : ''}`;
  plantsCount.textContent  = state.treesGrown;
}

function clearGarden() {
  gardenGround.querySelectorAll('.mini-tree').forEach(t => t.remove());
  state.treesGrown = 0;
  gardenCount.textContent = '0 trees';
  gardenEmpty.style.display = 'flex';
  plantsCount.textContent = 0;
}

// ── RAIN ─────────────────────────────────────────
function startRain() {
  rainContainer.innerHTML = '';
  for (let i = 0; i < 35; i++) {
    const drop = document.createElement('div');
    drop.classList.add('raindrop');
    drop.style.left             = `${Math.random() * 100}%`;
    drop.style.height           = `${Math.random() * 14 + 8}px`;
    drop.style.animationDuration = `${Math.random() * 0.7 + 0.5}s`;
    drop.style.animationDelay   = `${Math.random() * 1.5}s`;
    drop.style.opacity          = Math.random() * 0.35 + 0.1;
    rainContainer.appendChild(drop);
  }
  rainContainer.classList.add('active');
}

function stopRain() {
  rainContainer.classList.remove('active');
}

// ── WEB AUDIO CHIME ───────────────────────────────
function playChime() {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  } catch (e) {
    // Audio not supported — silent fail
  }
}

// ── TOAST ─────────────────────────────────────────
let toastTimer;

function showToast(title, msg) {
  toastTitle.textContent = title;
  toastMsg.textContent   = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

// ── INIT ─────────────────────────────────────────
(function init() {
  updateDisplay();
  updateRing();
  resetTreeToSeed();
})();