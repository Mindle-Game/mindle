// Mindle: everything on screen. The rules live in logic.js and saving lives in
// storage.js; this file reads what the player does, asks logic.js how good a
// guess was, and draws the result.

import {
  MAX_GUESSES, CLUE_PARTS, scoreGuess, prepareAnswers, formatYear, findByName, searchAnswers, pickRandom, filterAnswers,
  dateKey, puzzleNumber, msUntilMidnight, topicDailyAnswer, dailyFinished, DAILY_TOPICS,
  recordDaily, currentStreak, winRate, shareText,
} from './logic.js';
import {
  loadStats, saveStats, loadDaily, saveDaily, moveOldMixedDaily, recordResult, loadSettings, saveSettings,
  hasSeenHelp, markHelpSeen,
} from './storage.js';
import { el } from './dom.js';
import { registerServiceWorker } from './pwa.js';

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'),
  game: $('game'),
  modeInputs: document.querySelectorAll('input[name="mode"]'),
  dailyPicker: $('daily-picker'),
  dailyInputs: document.querySelectorAll('input[name="daily-topic"]'),
  filterPicker: $('filter-picker'),
  filterInputs: document.querySelectorAll('input[name="filter"]'),
  statsInputs: document.querySelectorAll('input[name="stats-topic"]'),
  tagline: $('tagline'),
  roundTitle: $('round-title'),
  clueList: $('clue-list'),
  clueCount: $('clue-count'),
  form: $('guess-form'),
  input: $('guess-input'),
  suggestions: $('suggestions'),
  guessCount: $('guess-count'),
  message: $('form-message'),
  guessList: $('guess-list'),
  guessKey: $('guess-key'),
  result: $('result'),
  resultHeading: $('result-heading'),
  resultSummary: $('result-summary'),
  answerName: $('answer-name'),
  answerMeta: $('answer-meta'),
  answerDescription: $('answer-description'),
  answerMethods: $('answer-methods'),
  answerFigures: $('answer-figures'),
  answerNotes: $('answer-notes'),
  share: $('share'),
  shareMessage: $('share-message'),
  shareFallback: $('share-fallback'),
  nextRound: $('next-round'),
  resultStats: $('result-stats'),
  countdown: $('countdown'),
  openStats: $('open-stats'),
  statsDialog: $('stats-dialog'),
  openHelp: $('open-help'),
  openSettings: $('open-settings'),
  settingsDialog: $('settings-dialog'),
  reduceMotionInput: $('reduce-motion'),
  deviceMotionNote: $('device-motion-note'),
  helpDialog: $('help-dialog'),
  encyclopediaLink: $('encyclopedia-link'),
  statNumbers: $('stat-numbers'),
  distribution: $('distribution'),
  announcer: $('announcer'),
};

// Words shown in each feedback cell, so the colours are never the only signal.
const ICONS = { green: '✓', amber: '≈', grey: '✗' };
const ORIGIN_NOTES = { green: 'Same place', amber: 'Same continent', grey: 'Elsewhere' };
const YEAR_RANGES = { green: 'within 20 yrs', amber: 'within 100 yrs', grey: 'over 100 yrs' };
const WIN_WORDS = ['Brilliant!', 'Excellent!', 'Great!', 'Nice!', 'Phew!', 'Just made it!'];
// Pop-up title for a wrong guess, by how many of the four boxes were green.
const WRONG_WORDS = ['Not it', 'Not quite', 'Getting close', 'So close!'];
const REVEAL_TIME = 1100; // ms for a new row's four boxes to flip over (see .guess.new in style.css)
const RESULT_DELAY = 800; // then ms to enjoy the last row before the answer card slides in
// The example in the guess box, by subject.
const EXAMPLES = { Philosophy: 'Stoicism', Psychology: 'Behaviourism' };

let answers = []; // every entry from data.json
// { mode: 'daily' | 'practice', dailyTopic: 'Philosophy' | 'Psychology', filter: 'Philosophy' | 'Psychology',
//   reduceMotion: true | false }
let settings = loadSettings();
let round = null; // the round on screen (see makeRound)
let practiceRound = null; // kept so switching to Daily and back doesn't lose it
let suggestions = []; // what the autocomplete list is showing
let active = -1; // which suggestion is highlighted (-1 = none)
let countdownTimer = null;

applyMotionSetting();
registerServiceWorker();
start();

async function start() {
  try {
    // 'no-cache' makes the browser check for a newer data.json each time
    // (a quick "not changed" reply if it hasn't), so new entries show up straight away.
    const response = await fetch('data.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`data.json returned ${response.status}`);
    answers = prepareAnswers(await response.json());
  } catch (error) {
    console.error(error);
    els.loading.textContent =
      'Could not load the answers. Mindle has to be opened through a local web server, not by double-clicking the file (see README).';
    return;
  }
  moveOldMixedDaily(answers);
  // Older versions saved other values (Practice used to have "Both"): fall back to Philosophy.
  if (!DAILY_TOPICS.includes(settings.dailyTopic)) settings.dailyTopic = 'Philosophy';
  if (!DAILY_TOPICS.includes(settings.filter)) settings.filter = 'Philosophy';
  els.loading.hidden = true;
  els.game.hidden = false;
  setUpInput();
  setUpControls();
  setMode(settings.mode);
  // First visit: explain the game before anything else.
  if (!hasSeenHelp()) {
    els.helpDialog.showModal();
    markHelpSeen();
  }
}

// ---------- rounds and modes ----------

// A round is one puzzle. `pool` is the list of answers it can be, and that
// you can guess from (one subject for the dailies; all or one subject in practice).
// `topic` is its subject (Philosophy or Psychology), in both modes.
function makeRound(mode, answer, pool, date = null, topic = null) {
  return { mode, answer, pool, date, topic, guesses: [], scores: [], over: false, won: false };
}

function setMode(mode) {
  settings.mode = mode;
  saveSettings(settings);
  for (const input of els.modeInputs) input.checked = input.value === mode;
  for (const input of els.dailyInputs) input.checked = input.value === settings.dailyTopic;
  for (const input of els.filterInputs) input.checked = input.value === settings.filter;
  els.dailyPicker.hidden = mode !== 'daily';
  els.filterPicker.hidden = mode !== 'practice';

  if (mode === 'daily') startDaily();
  else if (practiceRound) showRound(practiceRound);
  else newPracticeRound();
}

// Today's puzzle for the chosen subject: carry on from where you left off
// today, or start it fresh. Each subject's daily is saved separately.
function startDaily() {
  const topic = settings.dailyTopic;
  const pool = filterAnswers(answers, topic);
  const today = dateKey();
  let saved = loadDaily(topic);
  let answer = saved && saved.date === today ? answers.find((a) => a.id === saved.answerId) : null;
  if (!answer) {
    answer = topicDailyAnswer(answers, topic, today);
    saved = { date: today, answerId: answer.id, guesses: [] };
    saveDaily(topic, saved);
  }
  const daily = makeRound('daily', answer, pool, today, topic);
  for (const id of saved.guesses) {
    const entry = answers.find((a) => a.id === id);
    if (entry) applyGuess(daily, entry);
  }
  showRound(daily);
}

function otherTopic(topic) {
  return topic === 'Philosophy' ? 'Psychology' : 'Philosophy';
}

// Has today's daily for this subject been played to the end?
function dailyDoneToday(topic) {
  const saved = loadDaily(topic);
  return saved?.date === dateKey() && dailyFinished(saved);
}

function newPracticeRound() {
  const pool = filterAnswers(answers, settings.filter);
  practiceRound = makeRound('practice', pickRandom(pool, practiceRound?.answer.id), pool, null, settings.filter);
  showRound(practiceRound);
}

// Draw a whole round from scratch: title, clues, earlier guesses, result.
function showRound(next) {
  round = next;
  stopCountdown();
  els.guessList.replaceChildren();
  els.guessKey.hidden = true;
  round.guesses.forEach((entry, i) => addGuessRow(entry, round.scores[i], i + 1, false));
  els.input.value = '';
  setMessage('');
  closeSuggestions();
  renderTitle();
  renderClues();
  renderCount();
  els.form.hidden = round.over;
  if (round.over) showResult(false);
  else els.result.hidden = true;
}

// The round's title, plus the subtitle and the guess box's example, which follow its subject.
function renderTitle() {
  const subject = round.topic.toLowerCase();
  if (round.mode === 'daily') {
    const [y, m, d] = round.date.split('-').map(Number);
    const day = new Date(y, m - 1, d).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
    els.roundTitle.textContent = `Mindle ${round.topic} #${puzzleNumber(round.date)} · ${day}`;
    els.tagline.textContent = `Guess today's school of thought in ${subject}`;
  } else {
    els.roundTitle.textContent = `Practice round · ${round.topic} (${round.pool.length} answers)`;
    els.tagline.textContent = `Guess a school of thought in ${subject}`;
  }
  els.input.placeholder = `e.g. ${EXAMPLES[round.topic]}`;
}

function setUpControls() {
  for (const input of els.modeInputs) {
    input.addEventListener('change', () => setMode(input.value));
  }
  for (const input of els.dailyInputs) {
    input.addEventListener('change', () => switchDailyTopic(input.value));
  }
  for (const input of els.filterInputs) {
    input.addEventListener('change', () => {
      settings.filter = input.value;
      saveSettings(settings);
      newPracticeRound();
    });
  }
  for (const input of els.statsInputs) {
    input.addEventListener('change', () => renderStats(input.value));
  }
  // After a daily: on to today's other subject if it isn't done yet, otherwise Practice.
  els.nextRound.addEventListener('click', () => {
    if (round.mode === 'practice') {
      newPracticeRound();
      els.input.focus();
    } else if (!dailyDoneToday(otherTopic(round.topic))) {
      switchDailyTopic(otherTopic(round.topic));
      window.scrollTo({ top: 0, behavior: smoothOrInstant() });
    } else {
      setMode('practice');
    }
  });
  els.share.addEventListener('click', shareResult);
  els.openStats.addEventListener('click', openStats);
  els.openHelp.addEventListener('click', () => els.helpDialog.showModal());
  els.openSettings.addEventListener('click', openSettings);
  els.reduceMotionInput.addEventListener('change', () => {
    settings.reduceMotion = els.reduceMotionInput.checked;
    saveSettings(settings);
    // Rows and clues already on screen shouldn't replay their animation when it's switched back on.
    for (const row of document.querySelectorAll('.guess.new')) row.classList.remove('new');
    for (const clue of document.querySelectorAll('.clue.appear')) clue.classList.remove('appear');
    applyMotionSetting();
  });
  els.resultStats.addEventListener('click', openStats);
  // If the page was left open overnight, pick up the new daily puzzle when you come back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewDay();
  });
}

function switchDailyTopic(topic) {
  settings.dailyTopic = topic;
  saveSettings(settings);
  for (const input of els.dailyInputs) input.checked = input.value === topic;
  startDaily();
}

function checkForNewDay() {
  if (round?.mode === 'daily' && round.over && round.date !== dateKey()) startDaily();
}

// ---------- clues ----------

// One clue to start, plus one more for every wrong guess. All five once the round is over.
function cluesShown() {
  if (round.over) return round.answer.clues.length;
  return Math.min(round.answer.clues.length, round.guesses.length + 1);
}

// Shows the unlocked clues, plus one line saying the next one is still locked.
// (Listing every locked clue pushed the guesses off the bottom of a phone screen.)
// `animate` fades in the newest clue (just after a wrong guess).
function renderClues(animate = false) {
  const total = round.answer.clues.length;
  const shown = cluesShown();
  const items = round.answer.clues.slice(0, shown).map((text, i) => {
    const newest = i === shown - 1 && !round.over;
    let classes = 'clue';
    if (newest) classes += animate ? ' newest appear' : ' newest';
    return clueItem(i + 1, text, classes);
  });
  if (shown < total) items.push(clueItem(shown + 1, 'Unlocks after your next wrong guess', 'clue locked'));
  els.clueList.replaceChildren(...items);
  els.clueCount.textContent = `(${shown} of ${total})`;
}

function clueItem(number, text, classes) {
  return el('li', { class: classes },
    el('span', { class: 'clue-number', 'aria-hidden': 'true', text: number }),
    el('p', {}, el('span', { class: 'visually-hidden', text: `Clue ${number}: ` }), text));
}

function renderCount() {
  const next = Math.min(round.guesses.length + 1, MAX_GUESSES);
  els.guessCount.textContent = `(${next} of ${MAX_GUESSES})`;
}

// ---------- guessing ----------

function setUpInput() {
  els.input.addEventListener('input', () => {
    setMessage('');
    updateSuggestions();
  });
  els.input.addEventListener('keydown', onKeyDown);
  els.input.addEventListener('blur', closeSuggestions);
  // mousedown would normally take focus away from the input before the click lands.
  els.suggestions.addEventListener('mousedown', (event) => event.preventDefault());
  els.suggestions.addEventListener('click', (event) => {
    const item = event.target.closest('li');
    if (item) choose(Number(item.dataset.index));
  });
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitGuess();
  });
}

// Record a guess in a round and work out whether the round is over.
function applyGuess(target, entry) {
  const score = scoreGuess(entry, target.answer);
  target.guesses.push(entry);
  target.scores.push(score);
  if (score.correct) {
    target.over = true;
    target.won = true;
  } else if (target.guesses.length >= MAX_GUESSES) {
    target.over = true;
  }
  return score;
}

function submitGuess() {
  if (round.over) return;
  const typed = els.input.value;
  const entry = findByName(round.pool, typed);
  if (!entry) {
    let text = typed.trim() ? 'Pick an answer from the list.' : 'Type a few letters, then pick an answer from the list.';
    if (findByName(answers, typed)) {
      text = round.mode === 'daily'
        ? `That isn't a ${round.topic} answer, so it can't be today's ${round.topic} puzzle.`
        : `That isn't one of the ${settings.filter} answers. Change the topic to guess it.`;
    }
    setMessage(text);
    return;
  }
  if (round.guesses.some((g) => g.id === entry.id)) {
    setMessage(`You already guessed ${entry.name}.`);
    return;
  }

  const score = applyGuess(round, entry);
  if (round.mode === 'daily') {
    saveDaily(round.topic, { date: round.date, answerId: round.answer.id, guesses: round.guesses.map((g) => g.id) });
  }

  els.input.value = '';
  closeSuggestions();
  addGuessRow(entry, score, round.guesses.length, true);
  renderClues(true);
  renderCount();

  if (round.over) {
    finishRound();
  } else {
    const [title, detail] = wrongToastText(score); // worked out now, shown once the boxes have flipped
    afterReveal(() => showToast('bad', title, detail));
    const clue = round.answer.clues[cluesShown() - 1];
    announce(`${describeScore(entry, score)} Clue ${cluesShown()}: ${clue}`);
    // On a touch screen, close the keyboard so the new clue and feedback can be read.
    if (matchMedia('(pointer: coarse)').matches) els.input.blur();
    els.guessList.firstElementChild.scrollIntoView({ block: 'nearest', behavior: smoothOrInstant() });
  }
}

// Called once, when a round ends: save the result, pop up a message, then show the answer.
function finishRound() {
  recordResult(round.answer.id, round.won, round.date || dateKey());
  const result = round.won ? 'win' : 'loss';
  if (round.mode === 'daily') {
    saveStats(round.topic, recordDaily(loadStats(round.topic), round.date, round.won, round.guesses.length));
    countEvent(`daily-${round.topic.toLowerCase()}-${result}`, `Daily ${round.topic} finished: ${result}`);
  } else {
    countEvent('practice-finished', 'Practice game finished');
  }
  els.form.hidden = true;

  // Once the boxes have flipped: the pop-up, then (after a short pause to enjoy
  // the last row) the answer card.
  const used = round.guesses.length;
  const { name } = round.answer;
  if (round.won) afterReveal(() => showToast('good', 'Correct!', `${name} in ${used} ${used === 1 ? 'guess' : 'guesses'}`));
  else afterReveal(() => showToast('bad', 'Out of guesses', `It was ${name}`));
  afterReveal(() => showResult(true), RESULT_DELAY);
}

// Runs `action` once a new row's boxes have flipped over (straight away with
// reduced motion), plus `extra` ms. If the player switches mode or round in the
// meantime, the round it was for is no longer on screen, so it's skipped.
function afterReveal(action, extra = 0) {
  const current = round;
  setTimeout(() => {
    if (round === current) action();
  }, reduceMotion() ? 0 : REVEAL_TIME + extra);
}

// Counts an anonymous event with GoatCounter (no cookies, no personal data); its
// script is at the bottom of index.html. Does nothing if the script hasn't loaded
// or is blocked, or when playing on this computer (GoatCounter skips localhost).
function countEvent(path, title) {
  window.goatcounter?.count?.({ path, title, event: true });
}

// Less movement if the device asks for it, or the Reduce motion switch in Settings is on.
function reduceMotion() {
  return Boolean(settings.reduceMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The switch works through a class on <html>, which style.css uses to turn off all animation.
function applyMotionSetting() {
  document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
}

function smoothOrInstant() {
  return reduceMotion() ? 'auto' : 'smooth';
}

// ---------- pop-up messages ----------

let toastTimer = null;

// A small message at the top of the screen that disappears by itself.
// Screen readers skip it (aria-hidden), because the live region already reads the result.
function showToast(kind, title, detail) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const toast = el('div', { class: `toast ${kind}`, 'aria-hidden': 'true' },
    el('span', { class: 'toast-title', text: `${kind === 'good' ? '✓' : '✗'} ${title}` }),
    el('span', { class: 'toast-detail', text: detail }));
  document.body.append(toast);
  toastTimer = setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}

// The pop-up's title and detail after a wrong guess: "So close!" when 3 of the
// 4 boxes were green, down to "Not it" for none.
function wrongToastText(score) {
  const greens = CLUE_PARTS.filter((part) => score[part].status === 'green').length;
  const left = MAX_GUESSES - round.guesses.length;
  const guessesLeft = `${left} ${left === 1 ? 'guess' : 'guesses'} left`;
  // After the 4th wrong guess every clue is already showing.
  const newClue = round.guesses.length < round.answer.clues.length ? `Clue ${cluesShown()} unlocked · ` : '';
  return [WRONG_WORDS[greens], newClue + guessesLeft];
}

// ---------- feedback rows ----------

function addGuessRow(entry, score, number, animate) {
  const cells = el('div', { class: 'cells' },
    cell('Specialty', listWithShared(entry.specialties, score.specialty.shared), score.specialty.status, sharedNote(score.specialty)),
    cell('Began', formatYear(entry.year), score.year.status, yearNote(score.year)),
    cell('Origin', entry.place, score.origin.status, ORIGIN_NOTES[score.origin.status]),
    cell('Method', listWithShared(entry.methods, score.method.shared), score.method.status, sharedNote(score.method)));

  // A new row gets 'correct' or 'wrong' too, which picks its animation in style.css.
  const classes = animate ? `guess new ${score.correct ? 'correct' : 'wrong'}` : 'guess';
  [...cells.children].forEach((box, i) => box.style.setProperty('--i', i));
  const row = el('li', { class: classes },
    el('p', { class: 'guess-name' }, el('span', { class: 'guess-no', text: `Guess ${number}: ` }), entry.name),
    cells);
  els.guessList.prepend(row);
  els.guessKey.hidden = false; // the colour key, shown under the guesses once there are some
}

function cell(label, value, status, note) {
  return el('div', { class: `cell ${status}` },
    el('span', { class: 'cell-icon', 'aria-hidden': 'true', text: ICONS[status] }),
    el('span', { class: 'cell-label', text: label }),
    el('span', { class: 'cell-value' }, value),
    el('span', { class: 'cell-note' }, note));
}

// "↑ Later · within 20 yrs": the arrow points the way to go.
function yearNote(year) {
  if (year.direction === 'same') return 'Exact year';
  const arrow = year.direction === 'later' ? '↑' : '↓';
  const word = year.direction === 'later' ? 'Later' : 'Earlier';
  return el('span', {},
    el('span', { 'aria-hidden': 'true', text: `${arrow} ` }),
    `${word} · ${YEAR_RANGES[year.status]}`);
}

// Shared specialties and methods are underlined (and labelled for screen readers).
function listWithShared(items, shared) {
  const span = el('span', {});
  items.forEach((item, i) => {
    if (i > 0) span.append(', ');
    if (shared.includes(item)) {
      span.append(el('span', { class: 'tag shared', text: item }), el('span', { class: 'visually-hidden', text: ' (shared)' }));
    } else {
      span.append(item);
    }
  });
  return span;
}

// The note under a Specialty or Method box.
function sharedNote(list) {
  if (list.status === 'green') return 'Exact match';
  if (list.status === 'amber') return `${list.shared.length} shared`;
  return 'None shared';
}

// A one-sentence summary for screen readers.
function describeScore(entry, score) {
  const year = score.year.direction === 'same'
    ? 'exact year'
    : `answer began ${score.year.direction}, ${YEAR_RANGES[score.year.status]}`;
  return `${entry.name}: specialty ${sharedNote(score.specialty)}; ${year}; ${ORIGIN_NOTES[score.origin.status]}; method ${sharedNote(score.method)}.`;
}

// ---------- end of round ----------

// moveFocus is false when redrawing a round that had already finished (e.g. after a refresh).
function showResult(moveFocus) {
  const answer = round.answer;
  const used = round.guesses.length;
  els.resultHeading.textContent = round.won ? WIN_WORDS[used - 1] : 'Out of guesses';
  els.resultSummary.textContent = round.won
    ? `You got it in ${used} of ${MAX_GUESSES} guesses.`
    : `The answer was ${answer.name}.`;
  els.answerName.textContent = answer.name;
  els.answerMeta.textContent = `${answer.type} · ${answer.subjects.join(' & ')} · began ${formatYear(answer.year)} · ${answer.place}`;
  els.answerDescription.textContent = answer.description;
  els.answerMethods.textContent = answer.methods.join(', ');
  els.answerFigures.textContent = answer.figures.join(', ');
  const notes = [];
  if (answer.dateNote) notes.push(el('p', {}, el('strong', { text: 'About the date: ' }), answer.dateNote));
  if (answer.originNote) notes.push(el('p', {}, el('strong', { text: 'About the origin: ' }), answer.originNote));
  els.answerNotes.replaceChildren(...notes);
  els.encyclopediaLink.href = `encyclopedia.html#entry-${answer.id}`;

  const daily = round.mode === 'daily';
  if (!daily) els.nextRound.textContent = 'Next round';
  else if (!dailyDoneToday(otherTopic(round.topic))) els.nextRound.textContent = `Today's ${otherTopic(round.topic)}`;
  else els.nextRound.textContent = 'Practice mode';
  els.resultStats.hidden = !daily;
  els.shareMessage.textContent = '';
  els.shareFallback.hidden = true;
  els.countdown.hidden = !daily;
  if (daily) startCountdown();

  els.result.hidden = false;
  // Slide the card in when the round has just ended (not when reloading a finished one).
  els.result.classList.remove('reveal');
  if (moveFocus) {
    void els.result.offsetWidth; // makes the browser restart the animation
    els.result.classList.add('reveal');
    els.resultHeading.focus();
  }
}

// "Next Mindle in 05:12:09", ticking every second. At midnight it loads the new puzzle.
function startCountdown() {
  stopCountdown();
  const tick = () => {
    if (round.date !== dateKey()) {
      stopCountdown();
      startDaily();
      return;
    }
    const total = Math.floor(msUntilMidnight() / 1000);
    const parts = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
    els.countdown.textContent = `Next Mindle in ${parts.map((n) => String(n).padStart(2, '0')).join(':')}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
}

// ---------- sharing ----------

async function shareResult() {
  countEvent('share', 'Share button pressed');
  const text = shareText({
    title: round.mode === 'daily' ? `Mindle ${round.topic} #${puzzleNumber(round.date)}` : 'Mindle practice',
    won: round.won,
    scores: round.scores,
    url: location.origin + location.pathname,
  });
  if (await copyText(text)) {
    els.shareMessage.textContent = 'Copied! Paste it into a message.';
    els.shareFallback.hidden = true;
  } else {
    // Copying was blocked: show the text so it can be copied by hand.
    els.shareMessage.textContent = "Couldn't copy automatically. Select the text below and copy it.";
    els.shareFallback.textContent = text;
    els.shareFallback.hidden = false;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers: put the text in a hidden box and use the old copy command.
    const box = el('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
    box.value = text;
    document.body.append(box);
    box.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    box.remove();
    return copied;
  }
}

// ---------- statistics ----------

// Opens on the subject of the daily you're looking at (or your last daily subject).
function openSettings() {
  els.reduceMotionInput.checked = Boolean(settings.reduceMotion);
  els.deviceMotionNote.hidden = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.settingsDialog.showModal();
}

function openStats() {
  const topic = round?.mode === 'daily' ? round.topic : settings.dailyTopic;
  for (const input of els.statsInputs) input.checked = input.value === topic;
  renderStats(topic);
  els.statsDialog.showModal();
}

function renderStats(topic) {
  const stats = loadStats(topic);
  const today = dateKey();
  const numbers = [
    ['Played', stats.played],
    ['Win %', winRate(stats)],
    ['Current streak', currentStreak(stats, today)],
    ['Best streak', stats.bestStreak],
  ];
  els.statNumbers.replaceChildren(...numbers.map(([label, value]) =>
    el('div', {}, el('dt', { text: label }), el('dd', { text: value }))));

  // Highlight today's bar if today's daily was won.
  const showingTodaysWin = stats.lastWon === today && round?.mode === 'daily' && round.topic === topic && round.won;
  const todayRow = showingTodaysWin ? round.guesses.length - 1 : -1;
  const most = Math.max(1, ...stats.distribution);
  const rows = stats.distribution.map((count, i) => {
    // The longest bar fills the row, leaving room for its count.
    const bar = el('span', { class: i === todayRow ? 'dist-bar today' : 'dist-bar', style: `width: calc((100% - 2.5rem) * ${count / most})` });
    const wins = count === 1 ? 'win' : 'wins';
    return el('li', { class: 'dist-row' },
      el('span', { class: 'dist-label', 'aria-hidden': 'true', text: i + 1 }),
      el('span', { class: 'dist-track' },
        count ? bar : '',
        el('span', { class: 'dist-count', 'aria-hidden': 'true', text: count }),
        el('span', { class: 'visually-hidden', text: `${i + 1} ${i ? 'guesses' : 'guess'}: ${count} ${wins}${i === todayRow ? ', including today' : ''}` })));
  });
  els.distribution.replaceChildren(...rows);
}

// ---------- autocomplete ----------

function updateSuggestions() {
  const alreadyGuessed = new Set(round.guesses.map((g) => g.id));
  suggestions = searchAnswers(round.pool, els.input.value, alreadyGuessed);
  active = -1;
  renderSuggestions();
}

function renderSuggestions() {
  if (suggestions.length === 0) {
    closeSuggestions();
    if (els.input.value.trim()) setMessage('No answers match that. Try another word.');
    return;
  }
  const items = suggestions.map((s, i) => {
    const item = el('li', { id: `option-${i}`, role: 'option', 'aria-selected': String(i === active), 'data-index': i }, s.answer.name);
    if (s.matched !== s.answer.name) item.append(' ', el('span', { class: 'alias', text: `(${s.matched})` }));
    return item;
  });
  els.suggestions.replaceChildren(...items);
  els.suggestions.hidden = false;
  els.input.setAttribute('aria-expanded', 'true');
  if (active >= 0) {
    els.input.setAttribute('aria-activedescendant', `option-${active}`);
    items[active].scrollIntoView({ block: 'nearest' });
  } else {
    els.input.removeAttribute('aria-activedescendant');
  }
}

function closeSuggestions() {
  suggestions = [];
  active = -1;
  els.suggestions.hidden = true;
  els.suggestions.replaceChildren();
  els.input.setAttribute('aria-expanded', 'false');
  els.input.removeAttribute('aria-activedescendant');
}

// Picking a suggestion fills the box; pressing Enter or Guess then submits it.
function choose(index) {
  els.input.value = suggestions[index].answer.name;
  closeSuggestions();
  els.input.focus();
}

function onKeyDown(event) {
  const open = !els.suggestions.hidden;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!open) updateSuggestions();
    if (suggestions.length) {
      active = (active + 1) % suggestions.length;
      renderSuggestions();
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (open && suggestions.length) {
      active = active <= 0 ? suggestions.length - 1 : active - 1;
      renderSuggestions();
    }
  } else if (event.key === 'Enter' && open) {
    // Enter on a highlighted suggestion (or the only one) fills the box instead of guessing.
    if (active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (suggestions.length === 1 && !findByName(round.pool, els.input.value)) {
      event.preventDefault();
      choose(0);
    }
  } else if (event.key === 'Escape' && open) {
    event.preventDefault();
    closeSuggestions();
  }
}

// ---------- small helpers ----------

function setMessage(text) {
  els.message.textContent = text;
}

// Screen readers read whatever is put in the live region.
function announce(text) {
  els.announcer.textContent = '';
  requestAnimationFrame(() => { els.announcer.textContent = text; });
}

