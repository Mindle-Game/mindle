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

// Daily stats: played, wins, streaks, guess distribution.
export function loadStats() {
  return { ...emptyStats(), ...load('stats', {}) };
}
export function saveStats(stats) {
  save('stats', stats);
}

// Today's daily game, so a refresh doesn't lose it: { date, answerId, guesses: [ids] }.
// Saving the answer's id also "locks" today's answer, even if data.json changes mid-day.
export function loadDaily() {
  return load('daily', null);
}
export function saveDaily(daily) {
  save('daily', daily);
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
  return { mode: 'daily', filter: 'Both', ...load('settings', {}) };
}
export function saveSettings(settings) {
  save('settings', settings);
}
