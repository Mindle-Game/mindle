<img src="icons/icon-512.png" alt="Mindle's owl logo" width="120">

# Mindle

A daily guessing game for psychology and philosophy. You get one clue about a school of thought (Stoicism, Behaviourism, Daoism…) and six tries to name it. Every wrong guess unlocks another clue, and coloured feedback tells you how close you were.

It's plain HTML, CSS and JavaScript: no frameworks, no build step, nothing to install except Node (for the small helper tools). It works offline and can be added to a phone's home screen.

## Contents

- [Play it on your computer](#play-it-on-your-computer)
- [How the game works](#how-the-game-works)
- [What's in the folder](#whats-in-the-folder)
- [How the code works](#how-the-code-works)
- [Adding a new answer](#adding-a-new-answer)
- [Checking your work](#checking-your-work)
- [Changing the logo](#changing-the-logo)
- [Publishing on GitHub Pages](#publishing-on-github-pages)
- [Updating the live game](#updating-the-live-game)
- [Troubleshooting](#troubleshooting)

## Play it on your computer

```bash
node tools/serve.mjs
```

Then open **http://127.0.0.1:8080**. Press Ctrl+C in the terminal to stop the server.

Why a server? Browsers block a page opened straight from a file (`file://…`) from loading `data.json` or running the offline helper, so the game has to come from a web address, even a local one. `tools/serve.mjs` is a tiny server with no dependencies that also tells the browser never to hold on to stale copies, so a normal refresh always shows your latest changes.

To try it on the iPhone Simulator, open http://127.0.0.1:8080 in its Safari.

## How the game works

- You start with **clue 1**. Each wrong guess unlocks the next, up to 5. The last clue names the key thinkers.
- Pick guesses from the list that appears as you type.
- Each guess is compared with the answer:

| Box | Green ✓ | Amber ~ | Grey ✗ |
|---|---|---|---|
| **Field** | same field | one of them is "Both" | different |
| **Began** | within 20 years | within 100 years | further apart |
| **Origin** | same country | same continent | elsewhere |
| **Focus** | same topics | at least one shared | none shared |

  The **Began** box also shows ↑ if the answer began later, or ↓ if earlier.
- **Daily** gives everyone the same puzzle each day, changing at midnight. It counts towards your stats and streak.
- **Practice** gives unlimited random rounds, filtered by Philosophy, Psychology or Both.
- Every answer you meet is saved in the **Encyclopedia** for revision.

## What's in the folder

```
index.html            the game page
encyclopedia.html     the revision page
style.css             all the styling, light and dark mode
data.json             the answer bank, the file you edit to add answers
js/
  logic.js            the rules: scoring guesses, choosing the daily answer, stats
  app.js              the game screen: guess box, rows, pop-ups, sharing
  encyclopedia.js     the Encyclopedia screen
  storage.js          saving progress in the browser (localStorage)
  dom.js              a small helper for building page elements
  pwa.js              switches on the offline helper (service worker)
sw.js                 the service worker: keeps copies of the files for offline use
manifest.webmanifest  the app's name, colours and icons, for "Add to Home Screen"
icons/                the owl logo, drawn by tools/make-icons.mjs
tools/
  serve.mjs           local web server for testing
  check-data.mjs      finds mistakes in data.json
  test-logic.mjs      automatic tests of the game rules
  make-icons.mjs      draws the logo and app icons
```

## How the code works

**The rules are kept apart from the screen.** `logic.js` holds only rules (how a guess is scored, which answer is today's). It never touches the page, which is why `tools/test-logic.mjs` can test it on its own. `app.js` reads what you do, asks `logic.js` what it means, and draws the result.

**How the daily answer is chosen (the "bag").** There's no server choosing a puzzle, so every phone has to work out the same answer by itself. Picture all the answers in a bag:

1. Today's date is turned into a day number (days since `LAUNCH_DATE` in `logic.js`).
2. Each day, one answer is drawn. The draw is decided by a **hash**, a recipe that turns text like `"12:stoicism"` into a scrambled number. The answer with the lowest number wins. The same text always gives the same number, so every phone draws the same answer.
3. Drawn answers stay out of the bag, so nothing repeats until every answer has been used. Then the bag refills (skipping yesterday's answer).

The game replays every day since launch to know what's left in the bag. It sounds like a lot, but ten years of days takes about 20 milliseconds.

**Saving.** Your stats, today's progress and your Encyclopedia live in **localStorage**, a small store each website gets inside your browser. Nothing is sent anywhere. It stays on that one device and browser, and clearing your browser's website data wipes it.

**Working offline.** `sw.js` is a **service worker**, a script the browser runs in the background between the page and the internet. It keeps a copy of every file. When you're online it always fetches fresh files (and updates its copies). When you're offline it hands over the saved copies instead.

## Adding a new answer

1. Open `data.json` and add an entry to the `"answers"` list. Copy an existing one as a template. Answers are grouped by field and sorted by year, but the order doesn't affect the game.

```json
{
  "id": "cartesian-dualism",
  "name": "Cartesian dualism",
  "aliases": ["Mind-body dualism"],
  "field": "Philosophy",
  "year": 1641,
  "dateNote": "Descartes set it out in his Meditations on First Philosophy (1641).",
  "place": "France",
  "continent": "Europe",
  "focus": ["Mind", "Reality"],
  "figures": ["René Descartes", "Elisabeth of Bohemia", "Nicolas Malebranche"],
  "description": "Two sentences explaining it, in your own words.",
  "clues": ["vaguest clue", "…", "…", "…", "Key figures: René Descartes, Elisabeth of Bohemia and Nicolas Malebranche."],
  "added": "2027-01-31"
}
```

| Field | What to put |
|---|---|
| `id` | lower-case words joined by hyphens. Never change it later: stats depend on it |
| `name` | the answer as players will pick it |
| `aliases` | *optional.* Other names or spellings the search box should find (e.g. "Behaviorism") |
| `field` | `"Philosophy"`, `"Psychology"` or `"Both"` |
| `year` | the year it began; negative for BC (`-300` is 300 BC). There is no year 0 |
| `dateNote` | *optional.* Explain the date if it's disputed or approximate |
| `place` | the modern country where it began (`"UK"`, `"USA"`, `"Greece"`…) |
| `continent` | one of the continents listed at the top of `data.json` |
| `originNote` | *optional.* Explain the origin if it's complicated |
| `focus` | 1 to 3 tags from the `"tags"` list at the top of `data.json` |
| `figures` | the key thinkers |
| `description` | two sentences, in your own words |
| `clues` | exactly five, from vague to specific; the last names the key figures. No clue may contain the answer's name |
| `added` | **needed once the game is live:** the first date the answer can be a daily puzzle |

**Why `added` matters.** Every phone replays the daily "bag" from launch day. An answer without an `added` date counts as if it had always been in the bag, so adding it would quietly change past puzzles and possibly today's. Set `added` to **tomorrow's date or later** and everything up to then stays exactly as it was. Before launch you can leave it out.

2. Check it:

```bash
node tools/check-data.mjs
```

This catches missing fields, typos in tags, duplicate names and clues that give the answer away.

3. Refresh the game. Your new answer is in Practice straight away, and in the daily bag from its `added` date.

## Checking your work

```bash
node tools/test-logic.mjs
```

This runs automatic tests of the rules: scoring, dates, the daily bag never repeating, streaks and sharing. All tests should show ✔.

```bash
node tools/check-data.mjs
```

This checks the answer bank.

## Changing the logo

The owl is defined as a list of simple shapes in `tools/make-icons.mjs`: circles, rounded squares and curved outlines on a 100 × 100 grid. Edit a colour or a number near the top of that file, then redraw every icon:

```bash
node tools/make-icons.mjs
```

It takes about 15 seconds and rewrites everything in `icons/`.

## Publishing on GitHub Pages

GitHub Pages hosts websites for free, straight from a GitHub repository. On a free account the repository has to be **public**, which is why Mindle has its own repository, separate from your `learning` notes.

### 1. Set the launch date

In `js/logic.js`, set `LAUNCH_DATE` to the day you publish, so the first public puzzle is Mindle #1:

```js
export const LAUNCH_DATE = '2026-10-22';
```

After launch, **never change it again**: it would shift the whole daily schedule.

### 2. Put the code on GitHub

**The easy way: GitHub Desktop** (a free app; no commands needed).

1. Install GitHub Desktop from desktop.github.com and sign in with your GitHub account. When it asks how to show your name and email on commits, choose your GitHub **noreply** email to keep your real address private.
2. **File → Add Local Repository…** and choose this `mindle` folder.
3. Bottom left: type a summary such as "First version of Mindle" and click **Commit to main**.
4. Click **Publish repository**. Name it `mindle` and **untick "Keep this code private"**.

**Or with Terminal**, if you prefer typing (replace YOUR-USERNAME):

```bash
git add .
```

```bash
git commit -m "First version of Mindle"
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/mindle.git
```

```bash
git push -u origin main
```

Create the empty public `mindle` repository on github.com first. Git asks for a password when you push: use a **personal access token** from GitHub → Settings → Developer settings, not your account password.

### 3. Switch on Pages

1. On github.com, open the `mindle` repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute or two the page shows your address: **https://YOUR-USERNAME.github.io/mindle/**

### 4. Put it on your phone

Open that address in Safari on your iPhone → **Share** → **Add to Home Screen**. It opens like an app, with the owl icon, and works offline after the first visit.

## Updating the live game

Make your change, check it locally, then commit and push. In GitHub Desktop: write a summary → **Commit to main** → **Push origin**. GitHub Pages updates within a minute or two, and players get the new version the next time they open the game online.

If you **add a new file** to the game (not just a new answer), add its name to the `FILES` list at the top of `sw.js` and change `VERSION` (for example to `'mindle-v2'`), so phones save a copy of it for offline use.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Could not load the answers" | The page was opened as a file. Run `node tools/serve.mjs` and use http://127.0.0.1:8080 |
| A change doesn't show up | Refresh once more. Online, the game always fetches fresh files, but a page that was already open keeps its old copy until reloaded |
| "address already in use" when starting the server | The server is already running in another terminal. Use that one, or run `PORT=8081 node tools/serve.mjs` |
| Today's daily answer changed after adding answers | A new answer was added without an `added` date. Give it a future date |
| Stats disappeared | localStorage belongs to one browser on one device. A private window, a different browser or clearing website data starts afresh |
