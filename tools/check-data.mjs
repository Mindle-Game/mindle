// Checks data.json for mistakes before they reach the game.
// Run from the mindle folder:  node tools/check-data.mjs
// Errors (✖) must be fixed; warnings (!) are worth a look but won't break anything.

import fs from 'node:fs';

const FILE = new URL('../data.json', import.meta.url);
const SUBJECTS = ['Philosophy', 'Psychology'];
const REQUIRED = ['id', 'name', 'type', 'specialties', 'methods', 'year', 'place', 'continent', 'figures', 'description', 'clues'];
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

const specialtyLists = data.specialties || {};
const methodLists = data.methods || {};
const types = data.types || [];
const continents = data.continents || [];
const answers = data.answers || [];
for (const subject of SUBJECTS) {
  if (!specialtyLists[subject]?.length) errors.push(`the "specialties" list for ${subject} at the top is missing or empty`);
  if (!methodLists[subject]?.length) errors.push(`the "methods" list for ${subject} at the top is missing or empty`);
}
if (!types.length) errors.push('the "types" list at the top is missing or empty');
if (!continents.length) errors.push('the "continents" list at the top is missing or empty');
const allSpecialties = SUBJECTS.flatMap((s) => specialtyLists[s] || []);
const subjectsOf = (a) => SUBJECTS.filter((s) => (a.specialties || []).some((x) => (specialtyLists[s] || []).includes(x)));

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

  if ('type' in a && !types.includes(a.type)) err(`type "${a.type}" must be one of ${types.join(', ')}`);
  if ('year' in a && (!Number.isInteger(a.year) || a.year === 0)) err(`year ${a.year} must be a whole number (negative for BC, no year 0)`);
  if ('year' in a && a.year > new Date().getFullYear()) err(`year ${a.year} is in the future`);
  if ('place' in a && !isText(a.place)) err('"place" must be some text');
  if ('continent' in a && !continents.includes(a.continent)) err(`continent "${a.continent}" must be one of ${continents.join(', ')}`);

  if ('specialties' in a) {
    if (!Array.isArray(a.specialties) || a.specialties.length < 1 || a.specialties.length > 3) {
      err('"specialties" must be a list of 1 to 3');
    } else {
      for (const s of a.specialties) {
        if (!allSpecialties.includes(s)) err(`specialty "${s}" is not in either specialties list at the top`);
      }
      if (new Set(a.specialties).size !== a.specialties.length) err('a specialty is listed twice');
    }
  }

  if ('methods' in a) {
    if (!Array.isArray(a.methods) || a.methods.length < 1 || a.methods.length > 3) {
      err('"methods" must be a list of 1 to 3');
    } else {
      // Methods come from the list for the answer's own subject (either list if it's in both).
      const allowed = subjectsOf(a).flatMap((s) => methodLists[s] || []);
      for (const m of a.methods) {
        if (!allowed.includes(m)) err(`method "${m}" is not in the methods list for ${subjectsOf(a).join(' or ') || 'its subject'}`);
      }
      if (new Set(a.methods).size !== a.methods.length) err('a method is listed twice');
    }
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

// An answer's subject comes from its specialties; count how many fall in each.
const subjectCounts = { Philosophy: 0, Psychology: 0, Both: 0 };
for (const a of answers) {
  const s = subjectsOf(a);
  if (s.length === 2) subjectCounts.Both += 1;
  else if (s.length === 1) subjectCounts[s[0]] += 1;
}
console.log(`${answers.length} answers: ${subjectCounts.Philosophy} Philosophy, ${subjectCounts.Psychology} Psychology, ${subjectCounts.Both} in both.`);
for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.log(`✖ ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s) to fix.`);
  process.exit(1);
}
console.log(warnings.length ? '\nNo errors (see warnings above).' : '\n✔ All good.');
