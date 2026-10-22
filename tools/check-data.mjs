// Checks data.json for mistakes before they reach the game.
// Run from the mindle folder:  node tools/check-data.mjs
// Errors (✖) must be fixed; warnings (!) are worth a look but won't break anything.

import fs from 'node:fs';

const FILE = new URL('../data.json', import.meta.url);
const FIELDS = ['Philosophy', 'Psychology', 'Both'];
const REQUIRED = ['id', 'name', 'field', 'year', 'place', 'continent', 'focus', 'figures', 'description', 'clues'];
const OPTIONAL = ['aliases', 'dateNote', 'originNote', 'added'];

const errors = [];
const warnings = [];

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (error) {
  // JSON.parse says where it got stuck, e.g. a missing comma.
  console.error(`✖ data.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

const tags = data.tags || [];
const continents = data.continents || [];
const answers = data.answers || [];
if (!tags.length) errors.push('the "tags" list at the top is missing or empty');
if (!continents.length) errors.push('the "continents" list at the top is missing or empty');

const ids = new Map();
const names = new Map();
const isText = (v) => typeof v === 'string' && v.trim() !== '';

answers.forEach((a, index) => {
  const who = `answer ${index + 1} (${a.id || a.name || 'no id'})`;
  const err = (msg) => errors.push(`${who}: ${msg}`);
  const warn = (msg) => warnings.push(`${who}: ${msg}`);

  for (const key of REQUIRED) if (!(key in a)) err(`missing "${key}"`);
  for (const key of Object.keys(a)) {
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) warn(`unknown field "${key}" (a typo?)`);
  }

  if (isText(a.id)) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) err(`id "${a.id}" should be lower-case words joined by hyphens`);
    if (ids.has(a.id)) err(`id "${a.id}" is used twice`);
    ids.set(a.id, true);
  } else if ('id' in a) err('"id" must be some text');

  if (!isText(a.name) && 'name' in a) err('"name" must be some text');
  for (const name of [a.name, ...(a.aliases || [])].filter(isText)) {
    const key = name.toLowerCase();
    if (names.has(key)) err(`the name "${name}" is also used by ${names.get(key)}`);
    names.set(key, a.id);
  }
  if ('aliases' in a && !Array.isArray(a.aliases)) err('"aliases" must be a list, e.g. ["Behaviorism"]');

  if ('field' in a && !FIELDS.includes(a.field)) err(`field "${a.field}" must be one of ${FIELDS.join(', ')}`);
  if ('year' in a && (!Number.isInteger(a.year) || a.year === 0)) err(`year ${a.year} must be a whole number (negative for BC, no year 0)`);
  if ('year' in a && a.year > new Date().getFullYear()) err(`year ${a.year} is in the future`);
  if ('place' in a && !isText(a.place)) err('"place" must be some text');
  if ('continent' in a && !continents.includes(a.continent)) err(`continent "${a.continent}" must be one of ${continents.join(', ')}`);

  if ('focus' in a) {
    if (!Array.isArray(a.focus) || a.focus.length < 1 || a.focus.length > 3) err('"focus" must be a list of 1 to 3 tags');
    else for (const tag of a.focus) if (!tags.includes(tag)) err(`focus tag "${tag}" is not in the tags list (${tags.join(', ')})`);
  }

  if ('figures' in a && (!Array.isArray(a.figures) || !a.figures.every(isText) || !a.figures.length)) {
    err('"figures" must be a list of names');
  }

  if ('description' in a) {
    if (!isText(a.description)) err('"description" must be some text');
    else {
      const sentences = a.description.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length;
      if (sentences !== 2) warn(`description looks like ${sentences} sentences (aim for 2)`);
    }
  }

  if ('clues' in a) {
    if (!Array.isArray(a.clues) || a.clues.length !== 5 || !a.clues.every(isText)) err('"clues" must be a list of exactly 5 clues');
    else {
      // A clue that contains the answer's own name gives the game away.
      for (const name of [a.name, ...(a.aliases || [])].filter(isText)) {
        a.clues.forEach((clue, i) => {
          if (clue.toLowerCase().includes(name.toLowerCase())) err(`clue ${i + 1} gives away the answer ("${name}")`);
        });
      }
      const last = a.clues[4];
      if (Array.isArray(a.figures) && !a.figures.some((f) => last.includes(f.split(' ').pop()))) {
        warn('the last clue should name the key figures');
      }
    }
  }

  if ('dateNote' in a && !isText(a.dateNote)) err('"dateNote" must be some text');
  if ('originNote' in a && !isText(a.originNote)) err('"originNote" must be some text');
  if ('added' in a && !/^\d{4}-\d{2}-\d{2}$/.test(a.added)) err(`added "${a.added}" must be a date like 2027-01-31`);
});

const count = (field) => answers.filter((a) => a.field === field).length;
console.log(`${answers.length} answers: ${count('Philosophy')} Philosophy, ${count('Psychology')} Psychology, ${count('Both')} Both.`);
for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.log(`✖ ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s) to fix.`);
  process.exit(1);
}
console.log(warnings.length ? '\nNo errors (see warnings above).' : '\n✔ All good.');
