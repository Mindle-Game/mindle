// The Encyclopedia page: every answer you've met in Mindle, for revision.
// It reads the same saved results the game writes (see storage.js).

import { formatYear, filterAnswers, encyclopediaGroups, matchesSearch, prepareAnswers } from './logic.js';
import { loadResults } from './storage.js';
import { el } from './dom.js';
import { registerServiceWorker } from './pwa.js';

const $ = (id) => document.getElementById(id);

let answers = []; // every entry from data.json
let results = {}; // { id: { wins, losses, last } } for each answer you've met

registerServiceWorker();
start();

async function start() {
  try {
    const response = await fetch('data.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`data.json returned ${response.status}`);
    answers = prepareAnswers(await response.json());
  } catch (error) {
    console.error(error);
    $('loading').textContent = 'Could not load the answers. Open Mindle through a local web server (see README).';
    return;
  }
  results = loadResults();
  $('loading').hidden = true;
  $('book').hidden = false;

  $('search').addEventListener('input', render);
  for (const input of document.querySelectorAll('input[name="topic"]')) input.addEventListener('change', render);
  render();
  jumpToEntry();
}

function render() {
  const query = $('search').value;
  const topic = document.querySelector('input[name="topic"]:checked').value;
  const groups = encyclopediaGroups(answers, results);
  const met = groups.solved.length + groups.toRevise.length;

  const progress = [`Solved ${groups.solved.length} of ${answers.length}`];
  if (groups.toRevise.length) progress.push(`${groups.toRevise.length} to revise`);
  progress.push(`${groups.unseen} still to discover`);
  $('progress').textContent = met ? progress.join(' · ') : `${answers.length} schools of thought to discover`;

  const visible = (list) => filterAnswers(list, topic).filter((answer) => matchesSearch(answer, query));
  const toRevise = visible(groups.toRevise);
  const solved = visible(groups.solved);
  fillList('revise', toRevise);
  fillList('solved', solved);

  const filtering = query.trim() !== '' || topic !== 'Both';
  $('match-count').textContent = filtering && met ? `${toRevise.length + solved.length} of ${met} shown` : '';

  const empty = $('empty');
  if (!met) {
    empty.textContent = 'Nothing here yet. Play a round of Mindle and every answer you meet will be added here.';
  } else if (!toRevise.length && !solved.length) {
    empty.textContent = 'No matches. Try another word or topic.';
  }
  empty.hidden = met > 0 && toRevise.length + solved.length > 0;
}

function fillList(name, list) {
  $(`${name}-section`).hidden = list.length === 0;
  $(`${name}-list`).replaceChildren(...list.map(entryCard));
}

function entryCard(answer) {
  const record = results[answer.id];
  const notes = [];
  if (answer.dateNote) notes.push(el('p', {}, el('strong', { text: 'About the date: ' }), answer.dateNote));
  if (answer.originNote) notes.push(el('p', {}, el('strong', { text: 'About the origin: ' }), answer.originNote));

  return el('li', { class: 'card entry', id: `entry-${answer.id}`, tabindex: '-1' },
    el('h3', { class: 'entry-name', text: answer.name }),
    el('p', { class: 'entry-meta', text: `${answer.type} · ${answer.subjects.join(' & ')} · began ${formatYear(answer.year)} · ${answer.place}` }),
    el('ul', { class: 'tag-list', 'aria-label': 'Specialties' }, ...answer.specialties.map((s) => el('li', { class: 'tag-chip', text: s }))),
    el('p', { text: answer.description }),
    el('p', {}, el('strong', { text: 'Method: ' }), answer.methods.join(', ')),
    el('p', {}, el('strong', { text: 'Key figures: ' }), answer.figures.join(', ')),
    notes.length ? el('div', { class: 'answer-notes' }, ...notes) : '',
    el('details', { class: 'entry-clues' },
      el('summary', { text: 'Show the five clues' }),
      el('ol', {}, ...answer.clues.map((clue) => el('li', { text: clue })))),
    el('p', { class: 'entry-record', text: recordText(record) }));
}

// "Solved twice · missed once · last played 21 October"
function recordText({ wins, losses, last }) {
  const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const parts = [];
  if (wins) parts.push(`solved ${times(wins)}`);
  if (losses) parts.push(`missed ${times(losses)}`);
  if (last) {
    const [y, m, d] = last.split('-').map(Number);
    parts.push(`last played ${new Date(y, m - 1, d).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}`);
  }
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The game links here as encyclopedia.html#entry-stoicism: scroll to that card and highlight it.
function jumpToEntry() {
  const card = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (!card) return;
  card.scrollIntoView({ block: 'center' });
  card.classList.add('highlight');
  card.focus({ preventScroll: true });
}
