// Saving and loading. Mindle has no server: everything it remembers lives in
// localStorage, a small store the browser keeps for each website on this device.
// Clearing the browser's website data wipes it, and it doesn't sync between devices.
//
// Every read and write is wrapped in try/catch, because private browsing or
// blocked storage can make localStorage throw. The game still works then;
// it just won't remember anything.

import { emptyStats } from './logic.js';

const PREFIX = 'mindle.';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked: carry on without saving.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

// There are two daily puzzles, Philosophy and Psychology, and each has its own
// stats and saved game, stored under keys like "mindle.stats.psychology".
const topicKey = (name, topic) => `${name}.${topic.toLowerCase()}`;

// Daily stats for one topic: played, wins, streaks, guess distribution.
export function loadStats(topic) {
  return { ...emptyStats(), ...load(topicKey('stats', topic), {}) };
}
export function saveStats(topic, stats) {
  save(topicKey('stats', topic), stats);
}

// Today's daily game for one topic, so a refresh doesn't lose it:
// { date, answerId, guesses: [ids] }. Saving the answer's id also "locks" today's
// answer, even if data.json changes mid-day.
export function loadDaily(topic) {
  return load(topicKey('daily', topic), null);
}
export function saveDaily(topic, daily) {
  save(topicKey('daily', topic), daily);
}

// Before the split there was one mixed daily, saved as "mindle.daily" and
// "mindle.stats". Move them over once, into the topic of the answer that was
// played (a "Both" answer counts as Philosophy), so nobody loses a game or a streak.
export function moveOldMixedDaily(answers) {
  const oldDaily = load('daily', null);
  const oldStats = load('stats', null);
  if (!oldDaily && !oldStats) return;
  const answer = oldDaily && answers.find((a) => a.id === oldDaily.answerId);
  const topic = answer?.field === 'Psychology' ? 'Psychology' : 'Philosophy';
  if (oldDaily && !loadDaily(topic)) saveDaily(topic, oldDaily);
  if (oldStats && !load(topicKey('stats', topic), null)) save(topicKey('stats', topic), oldStats);
  remove('daily');
  remove('stats');
}

// Every answer you've met, in either mode, for the Encyclopedia:
// { "stoicism": { wins: 1, losses: 0, last: "2026-10-21" }, ... }
export function loadResults() {
  return load('results', {});
}
export function recordResult(id, won, date) {
  const results = loadResults();
  const entry = results[id] || { wins: 0, losses: 0, last: null };
  if (won) entry.wins += 1;
  else entry.losses += 1;
  entry.last = date;
  results[id] = entry;
  save('results', results);
}

// Whether How to play has been shown yet (it opens by itself on the first visit).
export function hasSeenHelp() {
  return load('seenHelp', false);
}
export function markHelpSeen() {
  save('seenHelp', true);
}

// Which mode and practice filter you used last.
export function loadSettings() {
  return { mode: 'daily', filter: 'Both', dailyTopic: 'Philosophy', ...load('settings', {}) };
}
export function saveSettings(settings) {
  save('settings', settings);
}
