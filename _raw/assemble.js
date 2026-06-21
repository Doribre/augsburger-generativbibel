// Baut data/books/<bookId>.json aus Urtext + Übersetzungen eines Buches.
// Aufruf: node _raw/assemble.js <bookId> <greekJson> <outDir> [notesJson]
//   z.B. node _raw/assemble.js markus _raw/greek_mark.json _raw/out _raw/notes_markus.json
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

const [bookId, greekArg, outArg, notesArg] = process.argv.slice(2);
if (!bookId || !greekArg || !outArg) {
  console.error('Aufruf: node _raw/assemble.js <bookId> <greekJson> <outDir> [notesJson]');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(path.join(BASE, 'data/nt_books.json'), 'utf8'));
const meta = catalog.find((b) => b.id === bookId);
if (!meta) { console.error('Unbekanntes Buch: ' + bookId); process.exit(1); }

const greek = JSON.parse(fs.readFileSync(path.resolve(greekArg), 'utf8'));
const outDir = path.resolve(outArg);
const notes = notesArg && fs.existsSync(path.resolve(notesArg)) ? JSON.parse(fs.readFileSync(path.resolve(notesArg), 'utf8')) : {};

// Übersetzungen: alle .json im outDir lesen, nach Kapitel (Feld "chapter") indizieren
const byChapter = {};
for (const f of fs.readdirSync(outDir)) {
  if (!f.endsWith('.json')) continue;
  let o;
  try { o = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')); } catch (e) { console.error('Ungültig: ' + f + ' (' + e.message + ')'); continue; }
  if (o && typeof o.chapter === 'number' && Array.isArray(o.verses)) {
    const m = {};
    for (const v of o.verses) m[v.v] = v;
    byChapter[o.chapter] = m;
  }
}

const chapters = {};
const verseCounts = {};
const problems = [];
let totalVerses = 0, omittedCount = 0, translated = 0;
const nch = Object.keys(greek).length;

for (let ch = 1; ch <= nch; ch++) {
  const gch = greek[ch];
  if (!gch) { problems.push('Kapitel ' + ch + ': kein Urtext.'); continue; }
  const tr = byChapter[ch] || null;
  if (!tr) problems.push('Kapitel ' + ch + ': keine Übersetzung gefunden.');
  const out = {};
  for (const gv of gch) {
    totalVerses++;
    const isOmitted = !gv.gr || !gv.gr.trim();
    if (isOmitted) { out[gv.v] = { omitted: true }; omittedCount++; continue; }
    const t = tr ? tr[gv.v] : null;
    if (!t || !t.l1 || !t.l2 || !t.l3) {
      problems.push(bookId + ' ' + ch + ',' + gv.v + ': Übersetzung unvollständig/fehlt.');
      out[gv.v] = { l1: (t && t.l1) || '', l2: (t && t.l2) || '', l3: (t && t.l3) || '', gr: gv.gr, gw: gv.words.map((w) => [w.w, w.s]), incomplete: true };
      continue;
    }
    out[gv.v] = { l1: t.l1.trim(), l2: t.l2.trim(), l3: t.l3.trim(), gr: gv.gr, gw: gv.words.map((w) => [w.w, w.s]) };
    translated++;
  }
  chapters[ch] = out;
  verseCounts[ch] = gch.length;
}

const data = {
  id: bookId,
  book: meta.name,
  short: meta.short,
  source: 'Tischendorf, Novum Testamentum Graece, 8. Ausgabe (Koine-Griechisch, gemeinfrei)',
  chapterCount: nch,
  verseCounts,
  notes,
  chapters,
};

fs.mkdirSync(path.join(BASE, 'data/books'), { recursive: true });
fs.writeFileSync(path.join(BASE, 'data/books/' + bookId + '.json'), JSON.stringify(data), 'utf8');

console.log('=== assemble: ' + meta.name + ' (' + bookId + ') ===');
console.log('Kapitel:', nch, '| Verse:', totalVerses, '| übersetzt:', translated, '| ausgelassen:', omittedCount, '| Notizen:', Object.keys(notes).length);
if (problems.length) { console.log('!!! PROBLEME (' + problems.length + '):'); for (const p of problems.slice(0, 40)) console.log('  - ' + p); }
else console.log('OK: keine Lücken, alle Verse vollständig.');
