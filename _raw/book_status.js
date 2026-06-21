// Ermittelt für ein Buch, welche Kapitel bereits gültig übersetzt sind und
// welche noch fehlen (oder kaputt sind) — damit ein erneuter Lauf nur die
// fehlenden Kapitel verarbeitet (keine doppelten Tokens).
//
//   node _raw/book_status.js <prefix> <greekJson>
//   z.B.  node _raw/book_status.js joh _raw/greek_johannes.json
//
// Ein Kapitel gilt als FERTIG, wenn _raw/out_<prefix>/<prefix>_NN.json existiert,
// valides JSON ist und genau so viele Verse enthält wie der Urtext (ohne [OMITTED]).
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const prefix = process.argv[2];
const greekArg = process.argv[3];
if (!prefix || !greekArg) {
  console.error('Aufruf: node _raw/book_status.js <prefix> <greekJson>');
  process.exit(1);
}
const greek = JSON.parse(fs.readFileSync(path.resolve(greekArg), 'utf8'));
const outDir = path.join(BASE, '_raw/out_' + prefix);
const pad = (n) => String(n).padStart(2, '0');

const done = [], todo = [], broken = [];
const chapters = Object.keys(greek).map(Number).sort((a, b) => a - b);

for (const ch of chapters) {
  const expected = greek[ch].filter((v) => v.gr && v.gr.trim()).length;
  const file = path.join(outDir, prefix + '_' + pad(ch) + '.json');
  if (!fs.existsSync(file)) { todo.push(ch); continue; }
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { todo.push(ch); broken.push(ch + ' (kein gültiges JSON)'); continue; }
  const n = Array.isArray(data.verses) ? data.verses.length : -1;
  const incomplete = (data.verses || []).some((v) => !v.l1 || !v.l2 || !v.l3);
  if (n !== expected || incomplete) {
    todo.push(ch);
    broken.push(ch + ' (' + n + '/' + expected + ' Verse' + (incomplete ? ', unvollständig' : '') + ')');
  } else {
    done.push(ch);
  }
}

console.log('Buch: ' + prefix + ' | Kapitel gesamt: ' + chapters.length);
console.log('FERTIG (' + done.length + '): ' + (done.join(',') || '–'));
console.log('OFFEN  (' + todo.length + '): ' + (todo.join(',') || '–'));
if (broken.length) console.log('davon fehlerhaft/unvollständig: ' + broken.join(' · '));
console.log('TODO_JSON=' + JSON.stringify(todo));
