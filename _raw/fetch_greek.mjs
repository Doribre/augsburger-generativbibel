import { writeFileSync } from 'node:fs';
const BOOK = 41; // Mark
const out = {};
const counts = [];
for (let ch = 1; ch <= 16; ch++) {
  const url = `https://bolls.life/get-text/TISCH/${BOOK}/${ch}/`;
  let data;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      break;
    } catch (e) {
      if (attempt === 2) { console.error('FAIL ch', ch, e.message); process.exit(1); }
      await new Promise(r => setTimeout(r, 800));
    }
  }
  const verses = data.map(v => {
    const raw = v.text;
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    const words = [];
    for (const tok of tokens) {
      const m = tok.match(/^(.*?)<S>(\d+)<\/S>$/);
      if (m) words.push({ w: m[1], s: Number(m[2]) });
      else words.push({ w: tok.replace(/<\/?S>/g,'').replace(/\d+/g,''), s: null });
    }
    const gr = words.map(x => x.w).join(' ');
    return { v: v.verse, gr, words };
  }).sort((a,b)=>a.v-b.v);
  out[ch] = verses;
  counts.push(`${ch}:${verses.length}`);
  await new Promise(r => setTimeout(r, 300));
}
writeFileSync('_raw/greek_mark.json', JSON.stringify(out, null, 1), 'utf8');
const total = Object.values(out).reduce((s,a)=>s+a.length,0);
console.log('verse counts:', counts.join('  '));
console.log('TOTAL verses:', total);
