// Quick automatic tests for the game rules in js/logic.js.
// Run from the mindle folder:  node tools/test-logic.mjs
// Each test() prints ✔ or ✖ with the reason.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  compareField, compareYear, compareOrigin, compareFocus, scoreGuess,
  formatYear, normalise, findByName, searchAnswers, pickRandom, filterAnswers,
  dateKey, daysBetween, addDays, puzzleNumber, msUntilMidnight, hash, dailySchedule, dailyAnswer,
  emptyStats, recordDaily, currentStreak, winRate, shareText, encyclopediaGroups, matchesSearch,
  DAILY_TOPICS, topicDailyAnswer, dailyFinished,
} from '../js/logic.js';

const data = JSON.parse(fs.readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const byId = (id) => data.answers.find((a) => a.id === id);

test('field: same is green, "Both" on either side is amber, otherwise grey', () => {
  assert.equal(compareField('Psychology', 'Psychology'), 'green');
  assert.equal(compareField('Both', 'Both'), 'green');
  assert.equal(compareField('Both', 'Philosophy'), 'amber');
  assert.equal(compareField('Psychology', 'Both'), 'amber');
  assert.equal(compareField('Philosophy', 'Psychology'), 'grey');
});

test('year: green within 20, amber within 100, grey beyond, with direction', () => {
  assert.deepEqual(compareYear(1913, 1913), { status: 'green', direction: 'same', gap: 0 });
  assert.deepEqual(compareYear(1893, 1913), { status: 'green', direction: 'later', gap: 20 });
  assert.deepEqual(compareYear(1934, 1913), { status: 'amber', direction: 'earlier', gap: 21 });
  assert.deepEqual(compareYear(1813, 1913), { status: 'amber', direction: 'later', gap: 100 });
  assert.deepEqual(compareYear(1812, 1913), { status: 'grey', direction: 'later', gap: 101 });
  // BC years are negative: 300 BC to 500 BC is 200 years earlier.
  assert.deepEqual(compareYear(-300, -500), { status: 'grey', direction: 'earlier', gap: 200 });
});

test('origin: same place green, same continent amber, otherwise grey', () => {
  const vienna = { place: 'Austria', continent: 'Europe' };
  assert.equal(compareOrigin(vienna, { place: 'Austria', continent: 'Europe' }), 'green');
  assert.equal(compareOrigin(vienna, { place: 'Germany', continent: 'Europe' }), 'amber');
  assert.equal(compareOrigin(vienna, { place: 'USA', continent: 'North America' }), 'grey');
});

test('focus: exact match green (order ignored), any overlap amber, none grey', () => {
  assert.deepEqual(compareFocus(['Mind', 'Development'], ['Development', 'Mind']), { status: 'green', shared: ['Mind', 'Development'] });
  assert.deepEqual(compareFocus(['Mind'], ['Mind', 'Knowledge']), { status: 'amber', shared: ['Mind'] });
  assert.deepEqual(compareFocus(['Mind', 'Ethics'], ['Mind']), { status: 'amber', shared: ['Mind'] });
  assert.deepEqual(compareFocus(['Ethics'], ['Mind']), { status: 'grey', shared: [] });
});

test('scoreGuess: the right answer is green everywhere', () => {
  const s = scoreGuess(byId('stoicism'), byId('stoicism'));
  assert.equal(s.correct, true);
  for (const part of ['field', 'year', 'origin', 'focus']) assert.equal(s[part].status, 'green');
});

test('scoreGuess: a real wrong guess (Psychoanalysis when the answer is Behaviourism)', () => {
  const s = scoreGuess(byId('psychoanalysis'), byId('behaviourism'));
  assert.equal(s.correct, false);
  assert.equal(s.field.status, 'green'); // both Psychology
  assert.deepEqual([s.year.status, s.year.direction], ['green', 'later']); // 1896 -> 1913
  assert.equal(s.origin.status, 'grey'); // Austria vs USA
  assert.equal(s.focus.status, 'grey'); // Mind, Development vs Behaviour
});

test('formatYear shows BC for negative years', () => {
  assert.equal(formatYear(-300), '300 BC');
  assert.equal(formatYear(1913), '1913');
});

test('names: matching ignores case, spaces and accents, and knows aliases', () => {
  assert.equal(normalise('  Köhler  Wolfgang '), 'kohler wolfgang');
  assert.equal(findByName(data.answers, 'behaviorism').id, 'behaviourism');
  assert.equal(findByName(data.answers, 'GESTALT PSYCHOLOGY').id, 'gestalt-psychology');
  assert.equal(findByName(data.answers, 'Behav'), null);
});

test('autocomplete: start-of-name matches come first, guessed ones are skipped', () => {
  const names = searchAnswers(data.answers, 'psych').map((r) => r.answer.id);
  assert.deepEqual(names.slice(0, 2), ['psychoanalysis', 'psychophysics']); // names starting with "psych"
  assert.equal(names[2], 'liberation-psychology'); // then aliases starting with it ("Psychology of liberation")
  assert.ok(names.includes('analytical-psychology')); // then names with a later word starting with it
  assert.equal(names.length, 8); // the list stops at 8
  const skipped = searchAnswers(data.answers, 'psych', new Set(['psychoanalysis'])).map((r) => r.answer.id);
  assert.ok(!skipped.includes('psychoanalysis'));
  assert.deepEqual(searchAnswers(data.answers, '   '), []);
});

test('pickRandom never repeats the round just played', () => {
  for (let i = 0; i < 200; i++) assert.notEqual(pickRandom(data.answers, 'stoicism').id, 'stoicism');
});

// ---------- Stage 2: practice filters, dates, the daily bag, stats, sharing ----------

test('filters: one subject also includes the "Both" entries; "Both" means everything', () => {
  const psych = filterAnswers(data.answers, 'Psychology');
  assert.ok(psych.every((a) => a.field === 'Psychology' || a.field === 'Both'));
  assert.ok(psych.some((a) => a.id === 'cognitive-science'));
  assert.equal(filterAnswers(data.answers, 'Both').length, data.answers.length);
});

test('dates: day counting ignores summer-time clock changes', () => {
  assert.equal(dateKey(new Date(2026, 9, 21, 23, 59)), '2026-10-21');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // clocks went forward on 29 March
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2); // and back on 25 October
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(puzzleNumber('2026-10-21', '2026-10-21'), 1);
  assert.equal(puzzleNumber('2026-11-20', '2026-10-21'), 31);
  assert.equal(msUntilMidnight(new Date(2026, 9, 21, 23, 0, 0)), 60 * 60 * 1000);
});

test('hash: the same text always gives the same number', () => {
  assert.equal(hash('3:stoicism'), hash('3:stoicism'));
  assert.notEqual(hash('3:stoicism'), hash('4:stoicism'));
});

test('daily bag: no repeats until every answer has been used', () => {
  const n = data.answers.length;
  const schedule = dailySchedule(data.answers, addDays('2026-10-21', 5 * n - 1), '2026-10-21');
  assert.equal(schedule.length, 5 * n);
  for (let cycle = 0; cycle < 5; cycle++) {
    const ids = schedule.slice(cycle * n, (cycle + 1) * n).map((a) => a.id);
    assert.equal(new Set(ids).size, n, `cycle ${cycle + 1} repeated an answer`);
  }
  // No back-to-back repeats where one bag ends and the next begins.
  for (let i = 1; i < schedule.length; i++) assert.notEqual(schedule[i].id, schedule[i - 1].id);
});

test('daily bag: the order changes from one cycle to the next', () => {
  const n = data.answers.length;
  const ids = dailySchedule(data.answers, addDays('2026-10-21', 2 * n - 1), '2026-10-21').map((a) => a.id);
  assert.notDeepEqual(ids.slice(0, n), ids.slice(n));
});

test('daily bag: same date, same answer, whatever order data.json is in', () => {
  const day = '2026-11-15';
  const reversed = [...data.answers].reverse();
  assert.equal(dailyAnswer(data.answers, day, '2026-10-21').id, dailyAnswer(reversed, day, '2026-10-21').id);
});

test('daily bag: an entry "added" for a later date changes nothing before that date', () => {
  const launch = '2026-10-21';
  const today = '2026-11-03';
  const before = dailySchedule(data.answers, today, launch).map((a) => a.id);
  const newEntry = { ...byId('stoicism'), id: 'test-new-school', name: 'Test new school', added: addDays(today, 1) };
  const after = dailySchedule([...data.answers, newEntry], today, launch).map((a) => a.id);
  assert.deepEqual(after, before);
  // ...and from its date on, it is in the bag, so it is drawn before the bag runs out.
  const oneBagLater = addDays(today, data.answers.length + 1);
  const later = dailySchedule([...data.answers, newEntry], oneBagLater, launch).map((a) => a.id);
  assert.ok(later.includes('test-new-school'));
});

test('stats: wins build a streak, a loss resets it, the same day never counts twice', () => {
  let s = emptyStats();
  s = recordDaily(s, '2026-10-21', true, 3);
  s = recordDaily(s, '2026-10-21', true, 3); // ignored: already played today
  s = recordDaily(s, '2026-10-22', true, 1);
  assert.deepEqual([s.played, s.wins, s.streak, s.bestStreak], [2, 2, 2, 2]);
  assert.deepEqual(s.distribution, [1, 0, 1, 0, 0, 0]);
  s = recordDaily(s, '2026-10-23', false, 6);
  assert.deepEqual([s.played, s.wins, s.streak, s.bestStreak], [3, 2, 0, 2]);
  assert.equal(winRate(s), 67);
});

test('stats: missing a day breaks the streak', () => {
  let s = recordDaily(emptyStats(), '2026-10-21', true, 2);
  s = recordDaily(s, '2026-10-23', true, 2); // skipped the 22nd
  assert.equal(s.streak, 1);
  assert.equal(currentStreak(s, '2026-10-24'), 1); // won yesterday: still alive
  assert.equal(currentStreak(s, '2026-10-25'), 0); // nothing yesterday: gone
});

test('share: one row of squares per guess, X/6 for a loss', () => {
  const scores = [scoreGuess(byId('psychoanalysis'), byId('behaviourism')), scoreGuess(byId('behaviourism'), byId('behaviourism'))];
  assert.equal(shareText({ title: 'Mindle #4', won: true, scores, url: 'https://example.org/mindle/' }),
    'Mindle #4 2/6\n🟩🟩⬜⬜\n🟩🟩🟩🟩\nhttps://example.org/mindle/');
  assert.ok(shareText({ title: 'Mindle #4', won: false, scores: scores.slice(0, 1) }).startsWith('Mindle #4 X/6'));
});

// ---------- Stage 4: the encyclopedia ----------

test('encyclopedia: solved, to revise, and how many are still unseen', () => {
  const results = {
    stoicism: { wins: 1, losses: 2, last: '2026-10-21' }, // solved at least once
    nihilism: { wins: 0, losses: 1, last: '2026-10-21' }, // only ever missed
    behaviourism: { wins: 2, losses: 0, last: '2026-10-20' },
  };
  const groups = encyclopediaGroups(data.answers, results);
  assert.deepEqual(groups.solved.map((a) => a.id), ['behaviourism', 'stoicism']); // A to Z
  assert.deepEqual(groups.toRevise.map((a) => a.id), ['nihilism']);
  assert.equal(groups.unseen, data.answers.length - 3);
  assert.deepEqual(encyclopediaGroups(data.answers, {}).solved, []);
});

test('encyclopedia search: finds names, other names, thinkers, tags and places', () => {
  assert.ok(matchesSearch(byId('psychoanalysis'), 'freud'));
  assert.ok(matchesSearch(byId('behaviourism'), 'behaviorism'));
  assert.ok(matchesSearch(byId('gestalt-psychology'), 'kohler')); // accents ignored
  assert.ok(matchesSearch(byId('confucianism'), 'china'));
  assert.ok(matchesSearch(byId('stoicism'), 'emotion'));
  assert.ok(!matchesSearch(byId('stoicism'), 'freud'));
  assert.ok(matchesSearch(byId('stoicism'), '  '));
});

// ---------- Two daily puzzles: Philosophy and Psychology ----------

test('topic dailies: each only draws from its own subject (plus "Both")', () => {
  const launch = '2026-10-22';
  for (const topic of DAILY_TOPICS) {
    const pool = filterAnswers(data.answers, topic);
    const seed = `${topic.toLowerCase()}:`;
    const schedule = dailySchedule(pool, addDays(launch, pool.length - 1), launch, seed);
    assert.ok(schedule.every((a) => a.field === topic || a.field === 'Both'), `${topic} drew another subject`);
    assert.equal(new Set(schedule.map((a) => a.id)).size, pool.length, `${topic} repeated before using every answer`);
    assert.equal(topicDailyAnswer(data.answers, topic, addDays(launch, 9), launch).id, schedule[9].id);
  }
});

test('topic dailies: the two subjects are drawn in different orders', () => {
  const launch = '2026-10-22';
  let same = 0;
  for (let day = 0; day < 60; day++) {
    const key = addDays(launch, day);
    if (topicDailyAnswer(data.answers, 'Philosophy', key, launch).id === topicDailyAnswer(data.answers, 'Psychology', key, launch).id) same++;
  }
  assert.ok(same <= 2, `the two dailies matched on ${same} of 60 days`); // only a "Both" answer could ever match
});

test('dailyFinished: won, lost after 6 guesses, or still going', () => {
  assert.equal(dailyFinished(null), false);
  assert.equal(dailyFinished({ answerId: 'stoicism', guesses: ['nihilism', 'stoicism'] }), true);
  assert.equal(dailyFinished({ answerId: 'stoicism', guesses: ['a', 'b', 'c', 'd', 'e', 'f'] }), true);
  assert.equal(dailyFinished({ answerId: 'stoicism', guesses: ['nihilism'] }), false);
});
