// State
let playerName = "-";
let shuffledQuestions = [];
let currentIndex = 0;
let score = 0;
let robotHp = 10; // used only to determine end screen pose
let timeLeft = 60;
let timerId = null;
let isQuizActive = false;
let selectedAvatar = null;
// (HP removed)

// Leaderboard config (Google Apps Script Web App)
const LEADERBOARD_URL = 'https://script.google.com/macros/s/AKfycbwLE0MwUxMv4VMAhlowt5gmhTDZUr_tj_119JVGhuqJuM9v3bmGaDqQU4AZS0r_qDhl3Q/exec';
const LEADERBOARD_TOKEN = ''; // optional: set if your Apps Script checks a token

// === Audio ===
const AUDIO_BASE = 'assets/audio/';
function createAudio(path, { loop = false, volume = 1 } = {}) {
  const a = new Audio(path);
  a.loop = loop; a.volume = volume;
  return a;
}
function playAudio(a) {
  if (!a) return;
  try { a.currentTime = 0; a.play(); } catch (_) {}
}
function stopAudio(a) { if (!a) return; a.pause(); a.currentTime = 0; }

const sfxByAvatar = {
  A: createAudio(AUDIO_BASE + 'A.mp3', { volume: 0.9 }),
  B: createAudio(AUDIO_BASE + 'B.mp3', { volume: 0.9 }),
  C: createAudio(AUDIO_BASE + 'C.mp3', { volume: 0.9 }),
  D: createAudio(AUDIO_BASE + 'D.mp3', { volume: 0.9 }),
  E: createAudio(AUDIO_BASE + 'E.mp3', { volume: 0.9 })
};
const sfxStartQuiz = createAudio(AUDIO_BASE + 'startquiz.mp3', { volume: 0.9 });
const bgmBattle = createAudio(AUDIO_BASE + 'battle.mp3', { loop: true, volume: 0.6 });
const sfxVictory = createAudio(AUDIO_BASE + 'victory.mp3', { volume: 0.9 });
const sfxDefeat = createAudio(AUDIO_BASE + 'defeat.mp3', { volume: 0.9 });
const sfxHit = createAudio(AUDIO_BASE + 'hit.mp3', { volume: 0.9 });
const sfxShoot = createAudio(AUDIO_BASE + 'shoot.mp3', { volume: 0.9 });
function stopAllBgm() { stopAudio(bgmBattle); }

// Elements
const screenLanding = document.getElementById('screen-landing');
const screenQuiz = document.getElementById('screen-quiz');
const screenEnd = document.getElementById('screen-end');
const screenSelect = document.getElementById('screen-select');
const screenLeaderboard = document.getElementById('screen-leaderboard');

const form = document.getElementById('player-form');
const inputName = document.getElementById('player-name');
const btnStart = document.getElementById('btn-start');
const btnBeginQuiz = document.getElementById('btn-begin-quiz');
const btnBackLanding = document.getElementById('btn-back-landing');
const avatarGrid = document.querySelector('.avatar-grid');
const btnViewLeaderboard = document.getElementById('btn-view-leaderboard');
const btnBackFromLeaderboard = document.getElementById('btn-back-from-leaderboard');

const hudName = document.getElementById('hud-name');
const hudScore = document.getElementById('hud-score');
const hudTimer = document.getElementById('hud-timer');
// (HP elements removed)

const questionText = document.getElementById('question-text');
const optionsList = document.getElementById('options');
const feedback = document.getElementById('feedback');

const endName = document.getElementById('end-name');
const endScore = document.getElementById('end-score');
const lbYourScore = document.getElementById('lb-your-score');
const btnRestart = document.getElementById('btn-restart');
const endMessage = document.getElementById('end-message');

// Stage elements
const heroLanding = document.getElementById('hero-landing');
const botLanding = document.getElementById('bot-landing');
const heroQuiz = document.getElementById('hero-quiz');
const botQuiz = document.getElementById('bot-quiz');

function playZap(stageEl) {
  if (!stageEl) return;
  let zap = stageEl.querySelector('.zap-line');
  if (!zap) {
    zap = document.createElement('div');
    zap.className = 'zap-line';
    stageEl.appendChild(zap);
  }
  zap.classList.remove('active');
  // Force reflow to restart animation
  // eslint-disable-next-line no-unused-expressions
  zap.offsetHeight;
  zap.classList.add('active');
}

function ensureHitOverlay(container, avatarKey) {
  if (!container) return null;
  let overlay = container.querySelector('.sprite-hit');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sprite-hit';
    container.appendChild(overlay);
  }
  // Set correct animation based on avatar
  let anim = '';
  if (container.classList.contains('bot')) anim = 'hit-villain 300ms steps(1) 1';
  else if (avatarKey === 'B') anim = 'hit-B 300ms steps(1) 1';
  else if (avatarKey === 'C') anim = 'hit-C 300ms steps(1) 1';
  else if (avatarKey === 'D') anim = 'hit-D 300ms steps(1) 1';
  else if (avatarKey === 'E') anim = 'hit-E 300ms steps(1) 1';
  else anim = 'hit-A 300ms steps(1) 1';
  overlay.style.animation = 'none';
  // Reflow
  // eslint-disable-next-line no-unused-expressions
  overlay.offsetHeight;
  overlay.style.animation = anim;
  overlay.classList.add('show');
  container.classList.add('is-hit');
  setTimeout(() => {
    overlay && overlay.classList.remove('show');
    container && container.classList.remove('is-hit');
  }, 280);
  return overlay;
}

// Utils
function showScreen(screen) {
  [screenLanding, screenSelect, screenQuiz, screenEnd, screenLeaderboard].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleSize(array, n) {
  return shuffle(array).slice(0, n);
}

function startTimer(seconds) {
  timeLeft = seconds;
  hudTimer.textContent = String(timeLeft);
  clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft -= 1;
    hudTimer.textContent = String(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timerId);
      isQuizActive = false;
      endQuiz();
    }
  }, 1000);
}

function proceedToSelect() {
  playerName = inputName.value.trim();
  if (!playerName) {
    inputName.focus();
    return;
  }
  hudName.textContent = playerName;
  showScreen(screenSelect);
}

function startQuiz() {
  score = 0;
  hudScore.textContent = String(score);
  feedback.textContent = '';
  feedback.className = 'feedback';
  robotHp = 10;

  const pool = Array.isArray(QUIZ_QUESTIONS) ? QUIZ_QUESTIONS : [];
  shuffledQuestions = shuffle(pool);
  currentIndex = 0;

  isQuizActive = true;
  showScreen(screenQuiz);
  // Apply chosen avatar to hero containers for CSS animation selection
  if (selectedAvatar) {
    heroLanding && heroLanding.setAttribute('data-avatar', selectedAvatar);
    heroQuiz && heroQuiz.setAttribute('data-avatar', selectedAvatar);
  }
  // start BGM
  stopAllBgm();
  playAudio(bgmBattle);
  startTimer(60);
  renderQuestion();
}

function renderQuestion() {
  if (shuffledQuestions.length === 0) return;
  const q = shuffledQuestions[currentIndex % shuffledQuestions.length];
  questionText.textContent = q.question;
  optionsList.innerHTML = '';

  q.options.forEach((opt, idx) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.setAttribute('data-index', String(idx));
    btn.addEventListener('click', () => onAnswer(idx));
    li.appendChild(btn);
    optionsList.appendChild(li);
  });
}

function onAnswer(selectedIndex) {
  if (!isQuizActive) return;
  const q = shuffledQuestions[currentIndex % shuffledQuestions.length];
  const correctIndex = q.answerIndex;
  const buttons = optionsList.querySelectorAll('.option-btn');

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIndex) btn.classList.add('correct');
  });

  if (selectedIndex === correctIndex) {
    score += 1;
    hudScore.textContent = String(score);
    feedback.textContent = 'Correct! +1';
    feedback.className = 'feedback correct';
    // Villain takes a hit: shake + overlay (no extra waves/lines)
    if (botQuiz) {
      botQuiz.classList.add('shake');
      ensureHitOverlay(botQuiz, 'villain');
    }
    // SFX for correct answer
    playAudio(sfxShoot);
    robotHp = Math.max(0, robotHp - 1);
  } else {
    const selectedBtn = buttons[selectedIndex];
    if (selectedBtn) selectedBtn.classList.add('incorrect');
    feedback.textContent = 'Incorrect! -5s';
    feedback.className = 'feedback incorrect';
    // Hero shakes when wrong + hero hit overlay
    heroQuiz && heroQuiz.classList.add('shake');
    ensureHitOverlay(heroQuiz, selectedAvatar || 'A');
    // Time penalty
    timeLeft = Math.max(0, timeLeft - 5);
    hudTimer.textContent = String(timeLeft);
    // SFX for wrong answer
    playAudio(sfxHit);
  }

  // Proceed to next after short delay
  setTimeout(() => {
    heroQuiz && heroQuiz.classList.remove('shake');
    botQuiz && botQuiz.classList.remove('shake');
    currentIndex = (currentIndex + 1) % shuffledQuestions.length;
    if (timeLeft <= 0) {
      endQuiz();
    } else {
      feedback.textContent = '';
      feedback.className = 'feedback';
      renderQuestion();
    }
  }, 700);
}

function endQuiz() {
  isQuizActive = false;
  clearInterval(timerId);
  endName.textContent = playerName || '-';
  endScore.textContent = String(score);
  lbYourScore.textContent = String(score);
  const heroEnd = document.getElementById('hero-end');
  const botEnd = document.getElementById('bot-end');
  const didWin = score >= 10;
  if (endMessage) {
    endMessage.textContent = didWin ? 'We defeated pr0nt0! Thank you Cyberhero!.' : 'You Lose! Get 10 correct to defeat pr0nt0. You can do better!';
    endMessage.className = didWin ? 'end-status win' : 'end-status lose';
  }
  // Apply poses
  if (heroEnd) {
    heroEnd.setAttribute('data-avatar', selectedAvatar || 'A');
    heroEnd.classList.remove('win','death','pose');
    heroEnd.classList.add(didWin ? 'win' : 'death','pose');
  }
  if (botEnd) {
    botEnd.classList.remove('win','death','bot');
    botEnd.classList.add(didWin ? 'death' : 'win','bot');
  }
  // Fire-and-forget submit to leaderboard
  submitScore(playerName, score, selectedAvatar || 'A');
  // Show latest leaderboard on end screen
  const endList = document.querySelector('#screen-end .lb-list');
  if (endList) {
    endList.innerHTML = '<li>Loading…</li>';
    // slight delay gives Apps Script a moment to append the row
    setTimeout(() => loadLeaderboardInto(endList, 10), 600);
  }
  // audio: end battle, play result
  stopAllBgm();
  if (didWin) playAudio(sfxVictory); else playAudio(sfxDefeat);
  showScreen(screenEnd);
}

function restart() {
  inputName.value = playerName;
  showScreen(screenLanding);
  inputName.focus();
}

// (updateHp removed)

// Events
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (inputName.validity.valid && inputName.value.trim()) {
    proceedToSelect();
  } else {
    inputName.reportValidity();
  }
});

btnRestart.addEventListener('click', restart);

if (btnBackLanding) {
  btnBackLanding.addEventListener('click', () => showScreen(screenLanding));
}

if (avatarGrid) {
  avatarGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.avatar-card');
    if (!card) return;
    document.querySelectorAll('.avatar-card').forEach(el => el.classList.remove('selected'));
    card.classList.add('selected');
    selectedAvatar = card.getAttribute('data-avatar');
    // Play avatar select sfx
    playAudio(sfxByAvatar[selectedAvatar]);
    if (btnBeginQuiz) btnBeginQuiz.disabled = false;
  });
}

if (btnBeginQuiz) {
  btnBeginQuiz.addEventListener('click', () => {
    playAudio(sfxStartQuiz);
    startQuiz();
  });
}

// Auto-load if navigating to leaderboard screen from anywhere
if (screenLeaderboard) {
  // Mutation-safe: load when we actually show the screen
  const observer = new MutationObserver(() => {
    if (screenLeaderboard.classList.contains('active')) {
      loadLeaderboard(10);
    }
  });
  observer.observe(screenLeaderboard, { attributes: true, attributeFilter: ['class'] });
}

if (btnBackFromLeaderboard) {
  btnBackFromLeaderboard.addEventListener('click', () => showScreen(screenLanding));
}

// Keyboard helpers
inputName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    // Let form submit handler handle validation
  }
});

// On load: focus name input
window.addEventListener('DOMContentLoaded', () => {
  inputName.focus();
});


// === Leaderboard helpers ===
async function submitScore(name, scoreValue, avatar) {
  try {
    if (!LEADERBOARD_URL) return;
    const payload = { name, score: scoreValue, avatar };
    if (LEADERBOARD_TOKEN) payload.token = LEADERBOARD_TOKEN;
    // Use no-cors to avoid blocking on CORS; we don't need the response body for POST
    await fetch(LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'no-cors',
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('submitScore failed', err);
  }
}

async function loadLeaderboardInto(list, limit = 10) {
  if (!list) return;
  try {
    const res = await fetch(`${LEADERBOARD_URL}?limit=${encodeURIComponent(limit)}`);
    const data = await res.json();
    if (!data || data.ok === false || !Array.isArray(data.rows)) throw new Error('Bad data');
    list.innerHTML = '';
    // Deduplicate by name+score to avoid duplicates when Sheets has repeated rows
    const seen = new Set();
    data.rows.forEach((r) => {
      const key = `${r.name}|${r.score}`;
      if (seen.has(key)) return;
      seen.add(key);
      const li = document.createElement('li');
      li.textContent = `${r.name} — ${r.score}`;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = '<li>Could not load leaderboard.</li>';
  }
}

async function loadLeaderboard(limit = 10) {
  const list = document.querySelector('#screen-leaderboard .lb-list');
  if (!list) return;
  list.innerHTML = '<li>Loading…</li>';
  await loadLeaderboardInto(list, limit);
}

