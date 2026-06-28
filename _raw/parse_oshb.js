// Parst OSHB (Open Scriptures Hebrew Bible, OSIS-XML, WLC-Text PD + Strong/Morph CC BY 4.0)
// zu unserem Urtext-Format (wie greek_<id>.json): { "<kap>": [ {v, gr, words:[{w,s}]} ] }
// + Kapiteldateien _raw/ch/<prefix>_NN.txt  ("Vers<TAB>Hebräisch").  OHNE LLM, deterministisch.
//
// Aufruf: node _raw/parse_oshb.js <osisFile> <osisBookCode> <prefix> <outName>
//   z.B.  node _raw/parse_oshb.js _raw/oshb/Ps.xml Ps ps psalmen
'use strict';
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

const [osisFile, bookCode, prefix, outName] = process.argv.slice(2);
if (!osisFile || !bookCode || !prefix || !outName) {
  console.error('Aufruf: node _raw/parse_oshb.js <osisFile> <osisBookCode> <prefix> <outName>');
  process.exit(1);
}
const xml = fs.readFileSync(path.resolve(osisFile), 'utf8');
const pad = (n) => String(n).padStart(2, '0');

// Strong-Nummer aus lemma ableiten: "d/376"->H376, "834 a"->H834, "c/m/6529"->H6529
function strongOf(lemma) {
  if (!lemma) return '';
  const last = lemma.split('/').pop();
  const m = last.match(/\d+/);
  return m ? 'H' + m[0] : '';
}
const stripTags = (s) => s.replace(/<[^>]*>/g, '');

// einen Vers-Innenraum zu {gr, words} verarbeiten
function parseVerse(inner) {
  let gr = '';
  let glue = false; // nach Maqqef direkt ankleben
  const words = [];
  const tokenRe = /<w\b([^>]*)>([\s\S]*?)<\/w>|<seg\b([^>]*)>([\s\S]*?)<\/seg>/g;
  let m;
  while ((m = tokenRe.exec(inner))) {
    if (m[1] !== undefined) {
      // <w>
      const attrs = m[1];
      const lemMatch = attrs.match(/lemma="([^"]*)"/);
      const word = stripTags(m[2]).replace(/\//g, '').replace(/\s+/g, '');
      if (!word) continue;
      gr += (gr === '' ? '' : (glue ? '' : ' ')) + word;
      glue = false;
      const s = lemMatch ? strongOf(lemMatch[1]) : '';
      words.push(s ? { w: word, s } : { w: word });
    } else {
      // <seg>
      const segAttrs = m[3] || '';
      const segText = stripTags(m[4] || '');
      const t = (segAttrs.match(/type="([^"]*)"/) || [])[1] || '';
      if (t === 'x-maqqef') { gr += '־'; glue = true; }
      else if (t === 'x-paseq') { gr += ' ׀'; glue = false; }
      else if (t === 'x-sof-pasuq') { gr += '׃'; glue = false; }
      // x-pe / x-samekh / x-reversednun: masoretische Abschnittsmarken -> für Lesetext weglassen
    }
  }
  return { gr: gr.trim(), words };
}

// Verse je Kapitel sammeln
const verseRe = new RegExp('<verse osisID="' + bookCode + '\\.(\\d+)\\.(\\d+)">([\\s\\S]*?)<\\/verse>', 'g');
const byCh = {};
let mm, total = 0;
while ((mm = verseRe.exec(xml))) {
  const ch = Number(mm[1]), v = Number(mm[2]);
  const { gr, words } = parseVerse(mm[3]);
  (byCh[ch] = byCh[ch] || []).push({ v, gr, words });
  total++;
}

const chapters = Object.keys(byCh).map(Number).sort((a, b) => a - b);
const out = {};
const chDir = path.join(BASE, '_raw/ch');
fs.mkdirSync(chDir, { recursive: true });
for (const ch of chapters) {
  const verses = byCh[ch].sort((a, b) => a.v - b.v);
  out[ch] = verses;
  const lines = verses.map((x) => x.v + '\t' + x.gr).join('\n') + '\n';
  fs.writeFileSync(path.join(chDir, prefix + '_' + pad(ch) + '.txt'), lines, 'utf8');
}
fs.writeFileSync(path.join(BASE, '_raw/hebrew_' + outName + '.json'), JSON.stringify(out), 'utf8');

// Stichproben + Statistik
const counts = chapters.map((c) => out[c].length);
console.log('parse_oshb: ' + chapters.length + ' Kapitel, ' + total + ' Verse → _raw/hebrew_' + outName + '.json + ch/' + prefix + '_NN.txt');
console.log('Verse je Kapitel (Stichprobe): Ps1=' + (out[1] || []).length + ', Ps23=' + (out[23] || []).length + ', Ps117=' + (out[117] || []).length + ', Ps119=' + (out[119] || []).length + ', Ps150=' + (out[150] || []).length);
console.log('Ps 1,1: ' + ((out[1] && out[1][0] && out[1][0].gr) || '?'));
console.log('Ps 1,1 Strong (erste 4 Wörter): ' + JSON.stringify(((out[1] && out[1][0] && out[1][0].words) || []).slice(0, 4)));
