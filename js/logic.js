// Mindle's game rules. There is no screen code in this file, so the rules can be
// tested on their own: run  node tools/test-logic.mjs
//
// Every comparison returns a status of 'green', 'amber' or 'grey'.

export const MAX_GUESSES = 6;
export const YEAR_CLOSE = 20; // green if the years are at most this far apart
export const YEAR_NEAR = 100; // amber if at most this far apart

// Field: green if the same, amber if either one is "Both", otherwise grey.
export function compareField(guess, answer) {
  if (guess === answer) return 'green';
  if (guess === 'Both' || answer === 'Both') return 'amber';
  return 'grey';
}

// Year: colour by how far apart, plus which way to go.
// direction says when the ANSWER began compared with the guess.
export function compareYear(guess, answer) {
  const gap = Math.abs(answer - guess);
  let status = 'grey';
  if (gap <= YEAR_CLOSE) status = 'green';
  else if (gap <= YEAR_NEAR) status = 'amber';

  let direction = 'same';
  if (answer > guess) direction = 'later';
  if (answer < guess) direction = 'earlier';

  return { status, direction, gap };
}

// Origin: green if the same place, amber if the same continent, otherwise grey.
export function compareOrigin(guess, answer) {
  if (guess.place === answer.place) return 'green';
  if (guess.continent === answer.continent) return 'amber';
  return 'grey';
}

// Focus: green if the tag lists match exactly, amber if they share at least one tag.
export function compareFocus(guessTags, answerTags) {
  const shared = guessTags.filter((tag) => answerTags.includes(tag));
  const exact = shared.length === guessTags.length && shared.length === answerTags.length;
  let status = 'grey';
  if (exact) status = 'green';
  else if (shared.length > 0) status = 'amber';
  return { status, shared };
}

// Score one guess against the answer. Both are entries from data.json.
export function scoreGuess(guess, answer) {
  return {
    id: guess.id,
    correct: guess.id === answer.id,
    field: { status: compareField(guess.field, answer.field) },
    year: compareYear(guess.year, answer.year),
    origin: { status: compareOrigin(guess, answer) },
    focus: compareFocus(guess.focus, answer.focus),
  };
}

// -300 -> "300 BC", 1913 -> "1913"
export function formatYear(year) {
  return year < 0 ? `${-year} BC` : String(year);
}

// Lower-case, strip accents and extra spaces, so "Köhler " matches "kohler".
export function normalise(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Find the entry whose name or alias is exactly this text (ignoring case and accents).
export function findByName(answers, text) {
  const wanted = normalise(text);
  if (!wanted) return null;
  return answers.find((a) => [a.name, ...(a.aliases || [])].some((n) => normalise(n) === wanted)) || null;
}

// Autocomplete: entries whose name or alias contains the typed text.
// Names that start with the text come first, then names with a word starting
// with it, then any other match. At each level a match on the real name beats
// a match on an alias. `skip` is a Set of ids already guessed.
export function searchAnswers(answers, query, skip = new Set(), limit = 8) {
  const q = normalise(query);
  if (!q) return [];
  const results = [];
  for (const answer of answers) {
    if (skip.has(answer.id)) continue;
    let best = null;
    [answer.name, ...(answer.aliases || [])].forEach((name, i) => {
      const n = normalise(name);
      let level = -1;
      if (n.startsWith(q)) level = 0;
      else if (n.split(' ').some((word) => word.startsWith(q))) level = 1;
      else if (n.includes(q)) level = 2;
      const rank = level * 2 + (i === 0 ? 0 : 1); // aliases rank just behind names
      if (level >= 0 && (best === null || rank < best.rank)) best = { rank, matched: name };
    });
    if (best) results.push({ answer, rank: best.rank, matched: best.matched });
  }
  results.sort((a, b) => a.rank - b.rank || a.answer.name.localeCompare(b.answer.name));
  return results.slice(0, limit);
}

// Pick a random entry for a practice round, avoiding the one just played if possible.
export function pickRandom(answers, avoidId = null, random = Math.random) {
  const pool = answers.length > 1 ? answers.filter((a) => a.id !== avoidId) : answers;
  return pool[Math.floor(random() * pool.length)];
}

// Practice filters. "Both" means everything; the single-subject filters
// also include the entries that belong to both fields.
export function filterAnswers(answers, filter) {
  if (filter === 'Philosophy' || filter === 'Psychology') {
    return answers.filter((a) => a.field === filter || a.field === 'Both');
  }
  return answers;
}

// ---------- dates ----------
// Dates are stored as text like "2026-10-21", using the player's own calendar,
// so the daily puzzle changes at their midnight.

// The first day of the daily puzzle (Mindle #1). It gets set to the launch day
// when the game goes on GitHub Pages; don't change it after that, or the
// whole daily schedule shifts.
export const LAUNCH_DATE = '2026-10-22';
const DAY_MS = 24 * 60 * 60 * 1000;

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Whole days from one date to another. Counted in UTC so the clocks going
// forward or back for summer time can't add or lose an hour.
export function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

export function addDays(key, days) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Mindle #1 on launch day, #2 the day after, and so on.
export function puzzleNumber(todayKey, launchKey = LAUNCH_DATE) {
  return daysBetween(launchKey, todayKey) + 1;
}

// Milliseconds until the player's next midnight, for the countdown.
export function msUntilMidnight(now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight - now;
}

// ---------- the daily answer ----------

// A hash turns text into a scrambled whole number. The same text always gives
// the same number, on every phone, so everyone's "random" draw matches.
// (FNV-1a to mix in each letter, then a few extra stirs so similar texts
// like "5:stoicism" and "6:stoicism" end up far apart.)
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// The daily answer, drawn from a "bag":
//  - each day, the entry in the bag with the lowest hash(day + id) is drawn;
//  - drawn entries stay out of the bag, so nothing repeats until all are used;
//  - when the bag is empty it is refilled, leaving out yesterday's answer;
//  - an entry with "added": "2027-01-31" only joins the bag from that date.
// To know what's left in the bag, it replays every day since launch.
// Returns the whole schedule up to today; the last item is today's answer.
export function dailySchedule(answers, todayKey, launchKey = LAUNCH_DATE) {
  const days = Math.max(0, daysBetween(launchKey, todayKey));
  const schedule = [];
  let used = new Set();
  let previous = null;

  for (let day = 0; day <= days; day++) {
    const key = addDays(launchKey, day);
    const available = answers.filter((a) => !a.added || a.added <= key);
    let bag = available.filter((a) => !used.has(a.id));
    if (bag.length === 0) {
      used = new Set();
      bag = available.filter((a) => a.id !== previous);
      if (bag.length === 0) bag = available; // only one entry exists
    }

    let pick = bag[0];
    let best = hash(`${day}:${pick.id}`);
    for (const entry of bag) {
      const score = hash(`${day}:${entry.id}`);
      if (score < best) {
        best = score;
        pick = entry;
      }
    }

    used.add(pick.id);
    previous = pick.id;
    schedule.push(pick);
  }
  return schedule;
}

export function dailyAnswer(answers, todayKey, launchKey = LAUNCH_DATE) {
  return dailySchedule(answers, todayKey, launchKey).at(-1);
}

// ---------- stats ----------
// Only daily games count, like Wordle.

export function emptyStats() {
  return { played: 0, wins: 0, streak: 0, bestStreak: 0, distribution: [0, 0, 0, 0, 0, 0], lastPlayed: null, lastWon: null };
}

// Add one finished daily game to the stats. Returns new stats; never counts the same day twice.
export function recordDaily(stats, todayKey, won, guessCount) {
  if (stats.lastPlayed === todayKey) return stats;
  const next = { ...stats, distribution: [...stats.distribution], played: stats.played + 1, lastPlayed: todayKey };
  if (won) {
    next.wins += 1;
    next.distribution[guessCount - 1] += 1;
    // The streak carries on only if yesterday's puzzle was won too.
    next.streak = stats.lastWon === addDays(todayKey, -1) ? stats.streak + 1 : 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    next.lastWon = todayKey;
  } else {
    next.streak = 0;
  }
  return next;
}

// A streak is only "current" if the last win was today or yesterday.
export function currentStreak(stats, todayKey) {
  const alive = stats.lastWon === todayKey || stats.lastWon === addDays(todayKey, -1);
  return alive ? stats.streak : 0;
}

export function winRate(stats) {
  return stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
}

// ---------- sharing ----------

const SQUARES = { green: '🟩', amber: '🟨', grey: '⬜' };

// One row of squares per guess: Field, Year, Origin, Focus.
export function shareText({ title, won, scores, url }) {
  const result = won ? `${scores.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const rows = scores.map((s) => [s.field, s.year, s.origin, s.focus].map((part) => SQUARES[part.status]).join(''));
  return [`${title} ${result}`, ...rows, url].filter(Boolean).join('\n');
}

// ---------- encyclopedia ----------

// Splits the answers you've met into "solved" (won at least once) and
// "to revise" (missed, never solved yet), each sorted A to Z.
// `results` is what storage.js saves: { id: { wins, losses, last } }.
export function encyclopediaGroups(answers, results) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const met = answers.filter((a) => results[a.id]);
  return {
    solved: met.filter((a) => results[a.id].wins > 0).sort(byName),
    toRevise: met.filter((a) => results[a.id].wins === 0).sort(byName),
    unseen: answers.length - met.length,
  };
}

// Encyclopedia search: looks in the name, other names, key figures, focus tags and place.
export function matchesSearch(answer, query) {
  const q = normalise(query);
  if (!q) return true;
  const haystack = [answer.name, ...(answer.aliases || []), ...answer.figures, ...answer.focus, answer.place];
  return haystack.some((text) => normalise(text).includes(q));
}
