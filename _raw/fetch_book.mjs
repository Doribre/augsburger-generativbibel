import { writeFileSync, mkdirSync } from 'node:fs';

// Wiederverwendbarer Einzelbuch-Fetcher (Tischendorf-Griechisch von bolls).
//   node _raw/fetch_book.mjs <bollsNum> <id> <prefix> <chapters> <Name>
//   z.B. node _raw/fetch_book.mjs 51 kolosser kol 4 Kolosser
const [bollsNum, id, prefix, chaptersArg, ...nameParts] = process.argv.slice(2);
const NCH = Number(chaptersArg);
const NAME = nameParts.join(' ');
if (!bollsNum || !id || !prefix || !NCH || !NAME) {
  console.error('Aufruf: node _raw/fetch_book.mjs <bollsNum> <id> <prefix> <chapters> <Name>');
  process.exit(1);
}
mkdirSync('_raw/ch', { recursive: true });

const out = {};
const counts = [];
const empties = [];
for (let ch = 1; ch <= NCH; ch++) {
  const url = `https://bolls.life/get-text/TISCH/${bollsNum}/${ch}/`;
  let data;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      break;
    } catch (e) {
      if (attempt === 3) { console.error('FAIL', id, 'ch', ch, e.message); process.exit(1); }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const verses = data.map((v) => {
    const tokens = (v.text || '').trim().split(/\s+/).filter(Boolean);
    const words = [];
    for (const tok of tokens) {
      const m = tok.match(/^(.*?)<S>(\d+)<\/S>$/);
      if (m) words.push({ w: m[1], s: Number(m[2]) });
      else words.push({ w: tok.replace(/<\/?S>/g, '').replace(/\d+/g, ''), s: null });
    }
    return { v: v.verse, gr: words.map((x) => x.w).join(' '), words };
  }).sort((a, b) => a.v - b.v);
  out[ch] = verses;
  counts.push(ch + ':' + verses.length);
  await new Promise((r) => setTimeout(r, 250));
}

writeFileSync('_raw/greek_' + id + '.json', JSON.stringify(out, null, 1), 'utf8');
for (const ch in out) {
  const lines = out[ch].map((v) => {
    const t = (v.gr && v.gr.trim()) ? v.gr.trim() : '[OMITTED]';
    if (t === '[OMITTED]') empties.push(ch + ':' + v.v);
    return v.v + '\t' + t;
  });
  writeFileSync('_raw/ch/' + prefix + '_' + String(ch).padStart(2, '0') + '.txt', lines.join('\n') + '\n', 'utf8');
}
const total = Object.values(out).reduce((s, a) => s + a.length, 0);
console.log(`${NAME} (${id}, bolls ${bollsNum}) — Kapitel: ${NCH}`);
console.log('counts:', counts.join('  '));
console.log('TOTAL:', total, '| ausgelassen:', empties.length, empties.length ? '→ ' + empties.join(', ') : '');
console.log('v1.1:', out[1][0].gr);
