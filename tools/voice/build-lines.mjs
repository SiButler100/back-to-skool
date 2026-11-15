#!/usr/bin/env node
// ============================================================================
// THE LIST OF LINES TO BE SPOKEN
// ----------------------------------------------------------------------------
// Works out, from the game's own words (src/data/messages.js), every sentence
// a master, Einstein or Albert can say, and writes tools/voice/lines.json:
//
//   lines       one entry per sentence: who says it, the words exactly as the
//               game produces them (that is how a clip is found again while
//               playing), the words as they should be read aloud, and the name
//               of the clip's file.
//   recordings  the lines grouped a few at a time. Each group is spoken in one
//               go with a blank line between sentences, and cut apart
//               afterwards by tools/voice/cut.py. That is far fewer requests
//               than one per sentence.
//
// Nothing is invented here: change a joke in messages.js, run this again, and
// the list follows.
//
//   node tools/voice/build-lines.mjs
// ============================================================================

import { writeFileSync } from 'node:fs';
import { MESSAGES } from '../../src/data/messages.js';
import { CHARACTERS } from '../../src/data/cast.js';
import { voiceKey } from '../../src/ui/voice.js';

const nameOf = (id) => (id === 'HERO' ? 'ERIC' : CHARACTERS.find((c) => c.id === id).name);

// ---- How the game's capital letters should be read aloud ----------------------
// The game writes everything in capitals with no punctuation. A voice reads
// better from ordinary sentences, so each kind of line is tidied here.

const KINGS = { 'JOHN': 'John', 'STEPHEN': 'Stephen', 'JAMES I': 'James the First', 'GEORGE V': 'George the Fifth', 'HENRY V': 'Henry the Fifth',
  'HENRY VII': 'Henry the Seventh', 'GEORGE I': 'George the First', 'CHARLES I': 'Charles the First' };
const YEARS = { 1199: 'eleven ninety-nine', 1135: 'eleven thirty-five', 1603: 'sixteen oh three', 1910: 'nineteen ten', 1413: 'fourteen thirteen',
  1485: 'fourteen eighty-five', 1714: 'seventeen fourteen', 1625: 'sixteen twenty-five' };
const PLACES = { 'TANZANIA': 'Tanzania', 'AUSTRALIA': 'Australia', 'ALASKA': 'Alaska', 'THE USSR': 'the U S S R', 'PERU': 'Peru', 'BOLIVIA': 'Bolivia',
  'NEW ZEALAND': 'New Zealand', 'WALES': 'Wales' };
const MOUNTAINS = { 'KILIMANJARO': 'Kilimanjaro', 'KOSCIUSKO': 'Kosciusko', 'McKINLEY': 'McKinley', 'KOMMUNISMA': 'Kommunisma', 'HUASCARAN': 'Huascaran',
  'SAJAMA': 'Sajama', 'COOK': 'Cook', 'SNOWDON': 'Snowdon' };
const PUPILS = { 'ERIC': 'Eric', 'BOY WANDER': 'Boy Wander', 'ANGELFACE': 'Angelface' };
const must = (table, word) => { if (!(word in table)) throw new Error(`No reading given for "${word}"`); return table[word]; };

// "DON'T HIT^YOUR MATES" -> "Don't hit your mates"
const sentence = (words) => { const s = words.replace(/\^/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); return s[0].toUpperCase() + s.slice(1); };
// Words the voice would otherwise stumble over or read as one lump.
const tidy = (s) => s.replace(/\bi\b/g, 'I').replace(/\bpta\b/g, 'P T A').replace(/\blatin\b/g, 'Latin').replace(/waterpistols/g, 'water pistols');

const lines = [];
const counters = {};
function add(speaker, words, spoken, kind) {
  counters[speaker] = (counters[speaker] || 0) + 1;
  const file = `${speaker.toLowerCase()}-${String(counters[speaker]).padStart(3, '0')}`;
  lines.push({ id: file, speaker, kind, key: voiceKey(words), spoken });
}

// ---- Reprimands: every one, for each of the five who hand out lines ---------------
const GIVERS = ['WACKER', 'WITHIT', 'ROCKITT', 'CREAK', 'TAKE'];
for (const giver of GIVERS) {
  for (const words of Object.values(MESSAGES.lines)) {
    let spoken = tidy(sentence(words));
    if (spoken === 'Come along you monster') spoken = 'Come along, you monster';
    add(giver, words, `${spoken}!`, 'reprimand');
  }
}

// ---- The start of a lesson ----------------------------------------------------
const SIT = { 'SIT DOWN CHAPS': 'Sit down, chaps.', 'SIT DOWN MY CHERUBS': 'Sit down, my cherubs.', 'SIT DOWN YOU LITTLE ANARCHISTS': 'Sit down, you little anarchists.', 'SIT DOWN': 'Sit down.' };
const LESSON = { 'START REVISING FOR YOUR EXAMS': 'Start revising for your exams.', 'START READING AT THE NEXT CHAPTER IN YOUR BOOKS': 'Start reading at the next chapter in your books.',
  "WRITE AN ESSAY TITLED 'WHY I LOVE SCHOOL'": 'Write an essay titled: Why I love school.' };
for (const [teacher, list] of Object.entries(MESSAGES.sitDown)) {
  for (const words of list) add(teacher, words, must(SIT, words), 'sit down');
  for (const words of MESSAGES.lesson) add(teacher, words, must(LESSON, words), 'lesson');
}

// ---- Questions, and Einstein's answers ------------------------------------------
// Each teacher has two questions about each of eight pairs of facts. Einstein
// always answers a master, so his "Please $TITLE" is "Please Sir".
const expand = (template, a, b) => template.replace(/\$1/g, a).replace(/\$2/g, b).replace(/\$TITLE/g, 'Sir');
const PLEASE = 'Please Sir, I cannot tell a lie,';
const READ = {
  CREAK: {
    Q1: ([king]) => `When did ${must(KINGS, king)} become king?`, Q2: ([, year]) => `Who became king in ${must(YEARS, year)}?`,
    A1: ([, year]) => `${PLEASE} it was in ${must(YEARS, year)}.`, A2: ([king]) => `${PLEASE} it was King ${must(KINGS, king)}.`,
  },
  WITHIT: {
    Q1: ([mount]) => `Where is Mount ${must(MOUNTAINS, mount)}?`, Q2: ([, place]) => `What is the highest mountain in ${must(PLACES, place)}?`,
    A1: ([, place]) => `${PLEASE} it is in ${must(PLACES, place)}.`, A2: ([mount]) => `${PLEASE} it is Mount ${must(MOUNTAINS, mount)}.`,
  },
  ROCKITT: {
    // The pairs carry their own "a" or "an": ' BADGER' gives "A BADGER", 'N EAGLE' gives "AN EAGLE".
    Q1: ([animal]) => `Where does a${animal.toLowerCase()} live?`, Q2: ([, home]) => `What lives in a${home.toLowerCase()}?`,
    A1: ([, home]) => `${PLEASE} it is a${home.toLowerCase()}.`, A2: ([animal]) => `${PLEASE} it is a${animal.toLowerCase()}.`,
  },
};
for (const [teacher, spec] of Object.entries(MESSAGES.qa)) {
  for (const pair of spec.pairs) {
    for (const q of ['Q1', 'Q2']) {
      add(teacher, expand(spec.questions[q], ...pair), READ[teacher][q](pair), 'question');
      add('SWOT', expand(spec.answers[q], ...pair), READ[teacher][q.replace('Q', 'A')](pair), 'answer');
    }
  }
}

// ---- Einstein telling tales ------------------------------------------------------
const g = MESSAGES.grass;
for (const id of g.hitters) add('SWOT', expand(g.hitTale, nameOf(id)), `${PLEASE} ${must(PUPILS, nameOf(id))} hit me.`, 'tale');
for (const id of g.writers) add('SWOT', expand(g.writeTale, nameOf(id)), `${PLEASE} ${must(PUPILS, nameOf(id))} wrote on the blackboard.`, 'tale');
add('SWOT', expand(g.absentTale.replace('$HERO', nameOf('HERO'))), `${PLEASE} Eric is not here.`, 'tale');

// ---- Mr Wacker at assembly: every verb with every noun -------------------------------
for (const verb of MESSAGES.assembly.VERB) {
  for (const noun of MESSAGES.assembly.NOUN) {
    const words = MESSAGES.assembly.template.replace('$VERB', verb).replace('$NOUN', noun);
    add('WACKER', words, `${tidy(sentence(words))}!`, 'assembly');
  }
}

// ---- Expulsions and the alarm: these have a pause inside them, so each is recorded alone ---
add('WACKER', MESSAGES.expelled.tooManyLines.replace('$HERO', 'ERIC'), "You have ten thousand lines, Eric. You're expelled!", 'alone');
add('WACKER', MESSAGES.expelled.notABird.replace('$HERO', 'ERIC'), "You are not a bird, Eric. You're expelled!", 'alone');
add('ALBERT', MESSAGES.escaping.replace('$WACKER', nameOf('WACKER')), "Mister Wacker! He's escaping!", 'alone');

// ---- Group the lines into recordings ---------------------------------------------
// At most eight lines and about 440 letters to a recording, so none runs much
// past half a minute. Lines with a pause inside them are recorded one at a time.
const MOST_LINES = 8, MOST_LETTERS = 440;
const recordings = [];
for (const speaker of [...new Set(lines.map((l) => l.speaker))]) {
  let n = 0, group = [], letters = 0;
  const close = () => { if (group.length) recordings.push({ id: `${speaker.toLowerCase()}-rec-${String(++n).padStart(2, '0')}`, speaker, lines: group.map((l) => l.id) }); group = []; letters = 0; };
  for (const l of lines.filter((x) => x.speaker === speaker)) {
    if (l.kind === 'alone') { close(); group = [l]; close(); continue; }
    if (group.length === MOST_LINES || letters + l.spoken.length > MOST_LETTERS) close();
    group.push(l); letters += l.spoken.length;
  }
  close();
}

// No two lines of one speaker may share their words, or one clip would hide the other.
const seen = new Set();
for (const l of lines) { const k = `${l.speaker}|${l.key}`; if (seen.has(k)) throw new Error(`Twice in the list: ${k}`); seen.add(k); }

writeFileSync(new URL('./lines.json', import.meta.url), `${JSON.stringify({
  note: 'Made by tools/voice/build-lines.mjs from src/data/messages.js. Do not edit by hand.',
  lines, recordings,
}, null, 1)}\n`);
const bySpeaker = {};
for (const l of lines) bySpeaker[l.speaker] = (bySpeaker[l.speaker] || 0) + 1;
console.log(`${lines.length} lines in ${recordings.length} recordings:`, bySpeaker);
