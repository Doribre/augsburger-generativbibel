// Test-Suite für den FD#0004-konformen Referenz-Parser (parseQuery).
// Wird standalone gegen data/nt_books.json getestet, bevor er in app.js wandert.
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(BASE, 'data/nt_books.json'), 'utf8'));

// ----- der zu testende Parser (identisch später in app.js) -----
const norm = (s) => String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
const patternMap = {};
for (const b of catalog) for (const p of [b.id, b.name, b.short].concat(b.abbr || [])) patternMap[norm(p)] = b.id;
const chaptersOf = (id) => { const b = catalog.find((x) => x.id === id); return b ? b.chapters : 0; };

function resolveBook(phrase) {
  const n = norm(phrase);
  if (!n) return null;
  if (!/[a-zäöü]/.test(n)) return null; // reine Ziffern sind ein Kapitel, kein Buch
  if (patternMap[n]) return patternMap[n];
  const ids = [...new Set(Object.keys(patternMap).filter((k) => k.indexOf(n) === 0).map((k) => patternMap[k]))];
  return ids.length === 1 ? ids[0] : null;
}
function parseVersePart(vp) {
  vp = vp.replace(/\s+/g, '');
  if (!vp) return null;
  const set = []; let any = false, ok = false;
  for (const it of vp.split(',').filter(Boolean)) {
    any = true;
    const r = it.match(/^(\d+)[a-z]?(?:-(\d+)[a-z]?)?$/i);
    if (!r) continue;
    const a = Number(r[1]);
    if (r[2] !== undefined) { const b = Number(r[2]); if (b < a) { ok = true; continue; } for (let x = a; x <= b; x++) set.push(x); ok = true; }
    else { set.push(a); ok = true; }
  }
  if (any && !ok) return undefined; // nichts Gültiges erkannt -> ungültig
  return [...new Set(set)].sort((x, y) => x - y);
}
function parseSpec(spec) {
  spec = spec.trim();
  const m = spec.match(/^(\d+)\s*[ ,:]?\s*(.*)$/);
  if (!m) return { error: true };
  const chapter = Number(m[1]);
  const rest = (m[2] || '').trim();
  if (!rest) return { chapter, verses: null };
  const verses = parseVersePart(rest);
  if (verses === undefined) return { error: true };
  return { chapter, verses };
}
function parseQuery(input, defaultBookId) {
  if (input == null) return { error: 'empty' };
  let s = String(input).replace(/ /g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (!s) return { error: 'empty' };
  const parts = s.split(';').map((x) => x.trim()).filter(Boolean);
  const segs = [];
  let curBook = defaultBookId || null;
  for (const part of parts) {
    const toks = part.split(' ').filter(Boolean);
    let bookId = null, restToks = toks;
    for (let k = Math.min(toks.length, 4); k >= 1; k--) {
      const rest = toks.slice(k);
      if (rest.length === 0 || /^\d/.test(rest[0])) {
        const id = resolveBook(toks.slice(0, k).join(' '));
        if (id) { bookId = id; restToks = rest; break; }
      }
    }
    let specStr;
    if (bookId) { curBook = bookId; specStr = restToks.join(' '); }
    else specStr = part;
    if (!curBook) return { error: 'unknownbook', phrase: part };
    if (!specStr) { segs.push({ bookId: curBook, chapter: null, verses: null }); continue; }
    const sp = parseSpec(specStr);
    if (sp.error) return { error: 'format' };
    const meta = chaptersOf(curBook);
    if (sp.chapter < 1 || sp.chapter > meta) return { error: 'chapter', bookId: curBook, max: meta };
    segs.push({ bookId: curBook, chapter: sp.chapter, verses: sp.verses });
  }
  if (!segs.length) return { error: 'empty' };
  return { segments: segs };
}

// ----- Tests -----
function seg(b, c, v) { return { bookId: b, chapter: c, verses: v }; }
const T = [
  ['Johannes 3,16', null, [seg('johannes', 3, [16])]],
  ['Johannes 3 16', null, [seg('johannes', 3, [16])]],            // Leerzeichen-Trenner (mobil)
  ['joh 3:16', null, [seg('johannes', 3, [16])]],
  ['joh 3: 16', null, [seg('johannes', 3, [16])]],
  ['joh 3', null, [seg('johannes', 3, null)]],
  ['johannes', null, [seg('johannes', null, null)]],
  ['JOHANNES 3,16', null, [seg('johannes', 3, [16])]],            // Groß/klein
  ['1. Korinther 13,4-7', null, [seg('1korinther', 13, [4,5,6,7])]],
  ['1kor 13 4-7', null, [seg('1korinther', 13, [4,5,6,7])]],
  ['1 kor 13:4,7', null, [seg('1korinther', 13, [4,7])]],         // Versliste
  ['1.korinther 13,4a', null, [seg('1korinther', 13, [4])]],      // Halbvers
  ['markus 1,1-3; 2,1; 3', null, [seg('markus',1,[1,2,3]), seg('markus',2,[1]), seg('markus',3,null)]], // Semikolon+carryover
  ['gal 5,22-23', null, [seg('galater',5,[22,23])]],
  ['galat 5', null, [seg('galater',5,null)]],                     // eindeutiger Präfix
  ['römer 8 28', null, [seg('roemer',8,[28])]],
  ['offb 21', null, [seg('offenbarung',21,null)]],
  ['apg 2,1-4', null, [seg('apostelgeschichte',2,[1,2,3,4])]],
  ['joh 3,5–7', null, [seg('johannes',3,[5,6,7])]],          // typografischer Strich
  ['3', 'markus', [seg('markus',3,null)]],                        // bare Kapitel mit aktuellem Buch
  ['3:5', 'markus', [seg('markus',3,[5])]],
];
const ERR = [
  ['', null, 'empty'],
  ['3:5', null, 'unknownbook'],         // kein Buch, kein Default
  ['Xyz 1,1', null, 'unknownbook'],
  ['1', null, 'unknownbook'],           // mehrdeutiger Präfix -> als Buch nicht auflösbar, kein Default
];

let pass = 0, fail = 0;
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
for (const [inp, def, exp] of T) {
  const r = parseQuery(inp, def);
  if (r.segments && eq(r.segments, exp)) { pass++; }
  else { fail++; console.log('FAIL:', JSON.stringify(inp), '=>', JSON.stringify(r.segments || r), '\n   erwartet:', JSON.stringify(exp)); }
}
for (const [inp, def, ekind] of ERR) {
  const r = parseQuery(inp, def);
  if (r.error === ekind) pass++;
  else { fail++; console.log('FAIL(err):', JSON.stringify(inp), '=> erwartet error', ekind, 'bekam', JSON.stringify(r)); }
}
console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
