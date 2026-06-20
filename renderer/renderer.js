const CIRCUMFERENCE = 2 * Math.PI * 90; // 565.49

const SESSION = {
  focus: { label: 'Focus',       color: '#FF6B6B' },
  short: { label: 'Short Break', color: '#4ECDC4' },
  long:  { label: 'Long Break',  color: '#45B7D1' },
};

const TYPE_COLOR = { study: '#FF6B6B', break: '#4ECDC4' };

const cfg = {
  focus: 25, short: 5, long: 15, rounds: 4,
  notif: true, sound: true, beepCount: 3, autoAdvance: false,
};

let schedule = [
  { type: 'study', minutes: 25 },
  { type: 'break', minutes: 5 },
  { type: 'study', minutes: 25 },
  { type: 'break', minutes: 5 },
];

const st = {
  mode: 'standard', // 'standard' | 'schedule'
  session: 'focus',
  secondsLeft: 25 * 60,
  running: false,
  pomoDone: 0,
  scheduleStep: 0,
};

let ticker      = null;
let tickerStart = null; // Date.now() when the current run began
let tickerBase  = null; // secondsLeft at that moment

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const timeEl           = $('time');
const modeEl           = $('mode');
const ringEl           = $('ring');
const pomoEl           = $('pomo-count');
const playBtn          = $('play-btn');
const iconPlay         = $('icon-play');
const iconPause        = $('icon-pause');
const timerView        = $('timer-view');
const settingsView     = $('settings-view');
const scheduleView     = $('schedule-view');
const tabsRow          = $('tabs-row');
const schedProgressRow = $('sched-progress-row');
const stepNumEl        = $('step-num');
const stepTotalEl      = $('step-total');
const schedListEl      = $('sched-list');

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function currentSeg() { return schedule[st.scheduleStep]; }

function currentLabel() {
  if (st.mode === 'schedule') return currentSeg().type === 'study' ? 'Study' : 'Break';
  return SESSION[st.session].label;
}

function currentColor() {
  if (st.mode === 'schedule') return TYPE_COLOR[currentSeg().type];
  return SESSION[st.session].color;
}

function currentTotal() {
  if (st.mode === 'schedule') return currentSeg().minutes * 60;
  return cfg[st.session] * 60;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const total    = currentTotal();
  const progress = total > 0 ? st.secondsLeft / total : 0;
  const offset   = CIRCUMFERENCE * (1 - progress);
  const color    = currentColor();

  timeEl.textContent = fmt(st.secondsLeft);
  ringEl.style.strokeDashoffset = offset;
  modeEl.textContent = currentLabel();
  document.documentElement.style.setProperty('--accent', color);
  pomoEl.textContent = `🍅 ${st.pomoDone} / ${cfg.rounds}`;

  iconPlay.style.display  = st.running ? 'none' : '';
  iconPause.style.display = st.running ? ''      : 'none';

  const isSchedule = st.mode === 'schedule';
  tabsRow.style.display          = isSchedule ? 'none'  : 'flex';
  schedProgressRow.style.display = isSchedule ? 'flex'  : 'none';
  if (isSchedule) {
    stepNumEl.textContent   = st.scheduleStep + 1;
    stepTotalEl.textContent = schedule.length;
  }

  if (window.api) {
    window.api.updateIcon(progress);
    window.api.updateTooltip(`Pomodoro — ${st.running ? '▶' : '⏸'} ${fmt(st.secondsLeft)}`);
  }
}

// ── Sound ─────────────────────────────────────────────────────────────────────
function beep() {
  if (!cfg.sound) return;
  try {
    const ctx = new AudioContext();
    const count = cfg.beepCount;
    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + i * 0.5;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    }
  } catch (_) {}
}

// ── Advance ───────────────────────────────────────────────────────────────────
function notifyEnd() {
  if (!cfg.notif || !window.api) return;
  if (st.mode === 'schedule') {
    const nextStep = schedule[(st.scheduleStep + 1) % schedule.length];
    const nextLabel = nextStep.type === 'study' ? 'Study' : 'Break';
    window.api.notify(`${currentLabel()} complete!`, `Next: ${nextLabel} (${nextStep.minutes} min)`);
  } else {
    window.api.notify(`${SESSION[st.session].label} complete!`, 'Starting next session.');
  }
}

function advance() {
  if (st.mode === 'schedule') {
    st.scheduleStep = (st.scheduleStep + 1) % schedule.length;
    st.secondsLeft  = currentSeg().minutes * 60;
  } else {
    if (st.session === 'focus') {
      st.pomoDone++;
      st.session = (st.pomoDone % cfg.rounds === 0) ? 'long' : 'short';
    } else {
      st.session = 'focus';
    }
    st.secondsLeft = cfg[st.session] * 60;
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.session === st.session);
    });
  }
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function startTicker() {
  tickerStart = Date.now();
  tickerBase  = st.secondsLeft;
  ticker = setInterval(onTick, 500); // poll at 2× rate; wall-clock keeps it accurate
}

function onTick() {
  const elapsed = Math.floor((Date.now() - tickerStart) / 1000);
  const next    = Math.max(0, tickerBase - elapsed);
  if (next === st.secondsLeft) return; // no visible change yet
  st.secondsLeft = next;

  if (st.secondsLeft <= 0) {
    clearInterval(ticker); ticker = null;
    st.running = false;
    beep();
    notifyEnd();
    advance();
    if (cfg.autoAdvance) {
      st.running = true;
      startTicker();
    }
  }
  render();
}

// ── Controls ──────────────────────────────────────────────────────────────────
function togglePlay() {
  if (st.running) {
    clearInterval(ticker); ticker = null;
    st.running = false;
  } else {
    st.running = true;
    startTicker();
  }
  render();
}

function resetTimer() {
  clearInterval(ticker); ticker = null;
  st.running = false;
  st.secondsLeft = currentTotal();
  render();
}

function skip() {
  clearInterval(ticker); ticker = null;
  st.running = false;
  advance();
  render();
}

// ── Schedule mode ─────────────────────────────────────────────────────────────
function startSchedule() {
  if (!schedule.length) return;
  clearInterval(ticker); ticker = null;
  st.mode          = 'schedule';
  st.scheduleStep  = 0;
  st.running       = false;
  st.secondsLeft   = schedule[0].minutes * 60;
  showView('timer');
  render();
}

function exitSchedule() {
  clearInterval(ticker); ticker = null;
  st.mode        = 'standard';
  st.running     = false;
  st.session     = 'focus';
  st.secondsLeft = cfg.focus * 60;
  render();
}

// ── View switching ────────────────────────────────────────────────────────────
function showView(name) {
  timerView.classList.toggle('hidden',    name !== 'timer');
  settingsView.classList.toggle('hidden', name !== 'settings');
  scheduleView.classList.toggle('hidden', name !== 'schedule');
}

// ── Schedule list ─────────────────────────────────────────────────────────────
function renderScheduleList() {
  schedListEl.innerHTML = '';

  schedule.forEach((seg, idx) => {
    const item = document.createElement('div');
    item.className = 'sched-item';
    item.innerHTML = `
      <div class="seg-pill-group">
        <button class="seg-pill ${seg.type === 'study' ? 'active-study' : ''}" data-idx="${idx}" data-type="study">Study</button>
        <button class="seg-pill ${seg.type === 'break' ? 'active-break' : ''}" data-idx="${idx}" data-type="break">Break</button>
      </div>
      <div class="seg-dur-group">
        <button class="seg-adj" data-idx="${idx}" data-delta="-1">−</button>
        <input type="number" class="seg-min-input" value="${seg.minutes}" min="1" max="180" data-idx="${idx}">
        <button class="seg-adj" data-idx="${idx}" data-delta="1">+</button>
        <span class="seg-unit">min</span>
      </div>
      <button class="seg-delete" data-idx="${idx}" ${schedule.length <= 1 ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    schedListEl.appendChild(item);
  });

  // Type pills
  schedListEl.querySelectorAll('.seg-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      schedule[idx].type = btn.dataset.type;
      savePrefs(); renderScheduleList();
    });
  });

  // +/- buttons with hold-to-repeat
  schedListEl.querySelectorAll('.seg-adj').forEach(btn => {
    let holdTimer = null, holdInterval = null;
    const apply = () => {
      const idx = +btn.dataset.idx;
      const delta = +btn.dataset.delta;
      schedule[idx].minutes = Math.max(1, Math.min(180, schedule[idx].minutes + delta));
      const input = schedListEl.querySelector(`.seg-min-input[data-idx="${idx}"]`);
      if (input) input.value = schedule[idx].minutes;
      savePrefs();
    };
    const clear = () => { clearTimeout(holdTimer); clearInterval(holdInterval); };
    btn.addEventListener('mousedown', () => { apply(); holdTimer = setTimeout(() => { holdInterval = setInterval(apply, 80); }, 400); });
    btn.addEventListener('mouseup', clear);
    btn.addEventListener('mouseleave', clear);
  });

  // Direct number input
  schedListEl.querySelectorAll('.seg-min-input').forEach(input => {
    input.addEventListener('change', () => {
      const idx = +input.dataset.idx;
      const val = Math.max(1, Math.min(180, parseInt(input.value) || 1));
      schedule[idx].minutes = val;
      input.value = val;
      savePrefs();
    });
  });

  // Delete
  schedListEl.querySelectorAll('.seg-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      schedule.splice(+btn.dataset.idx, 1);
      savePrefs(); renderScheduleList();
    });
  });
}

// ── Standard mode tabs ────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    clearInterval(ticker); ticker = null;
    st.running = false;
    st.session = tab.dataset.session;
    st.secondsLeft = cfg[st.session] * 60;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    render();
  });
});

// ── Button wiring ─────────────────────────────────────────────────────────────
playBtn.addEventListener('click', togglePlay);
$('reset-btn').addEventListener('click', resetTimer);
$('skip-btn').addEventListener('click', skip);
$('exit-sched-btn').addEventListener('click', exitSchedule);

$('settings-btn').addEventListener('click', () => showView('settings'));
$('back-settings-btn').addEventListener('click', () => showView('timer'));

$('schedule-btn').addEventListener('click', () => { renderScheduleList(); showView('schedule'); });
$('back-sched-btn').addEventListener('click', () => showView('timer'));
$('start-sched-btn').addEventListener('click', startSchedule);

$('add-seg-btn').addEventListener('click', () => {
  const last = schedule[schedule.length - 1];
  schedule.push({ type: last.type === 'study' ? 'break' : 'study', minutes: last.type === 'study' ? 5 : 25 });
  savePrefs(); renderScheduleList();
});

// ── Settings sliders ──────────────────────────────────────────────────────────
function bindSlider(inputId, valId, key, unit, extraFn) {
  const input = $(inputId), val = $(valId);
  input.value = cfg[key];
  val.textContent = unit ? `${cfg[key]} ${unit}` : `${cfg[key]}`;
  input.addEventListener('input', () => {
    cfg[key] = parseInt(input.value);
    val.textContent = unit ? `${cfg[key]} ${unit}` : `${cfg[key]}`;
    if (extraFn) extraFn();
    savePrefs();
  });
}

bindSlider('s-focus', 'v-focus', 'focus', 'min', () => { if (st.session === 'focus' && !st.running) { st.secondsLeft = cfg.focus * 60; render(); } });
bindSlider('s-short', 'v-short', 'short', 'min', () => { if (st.session === 'short' && !st.running) { st.secondsLeft = cfg.short * 60; render(); } });
bindSlider('s-long',  'v-long',  'long',  'min', () => { if (st.session === 'long'  && !st.running) { st.secondsLeft = cfg.long  * 60; render(); } });
bindSlider('s-rounds','v-rounds','rounds', null, () => render());

$('s-notif').addEventListener('change', (e) => { cfg.notif = e.target.checked; savePrefs(); });
$('s-sound').addEventListener('change', (e) => { cfg.sound = e.target.checked; savePrefs(); });
$('s-auto').addEventListener('change',  (e) => { cfg.autoAdvance = e.target.checked; savePrefs(); });
bindSlider('s-beeps', 'v-beeps', 'beepCount', null, null);

// ── Persistence ────────────────────────────────────────────────────────────────
function savePrefs() {
  localStorage.setItem('pomoCfg',      JSON.stringify(cfg));
  localStorage.setItem('pomoSchedule', JSON.stringify(schedule));
}

function loadPrefs() {
  try {
    const savedCfg = JSON.parse(localStorage.getItem('pomoCfg') || 'null');
    if (savedCfg) {
      Object.assign(cfg, savedCfg);
      ['focus','short','long'].forEach(k => {
        $(`s-${k}`).value = cfg[k];
        $(`v-${k}`).textContent = `${cfg[k]} min`;
      });
      $('s-rounds').value  = cfg.rounds;     $('v-rounds').textContent = cfg.rounds;
      $('s-beeps').value   = cfg.beepCount;  $('v-beeps').textContent  = cfg.beepCount;
      $('s-notif').checked = cfg.notif;
      $('s-sound').checked = cfg.sound;
      $('s-auto').checked  = cfg.autoAdvance;
    }
    const savedSched = JSON.parse(localStorage.getItem('pomoSchedule') || 'null');
    if (savedSched && savedSched.length > 0) schedule = savedSched;
    st.secondsLeft = cfg.focus * 60;
  } catch (_) {}
}

loadPrefs();
render();
