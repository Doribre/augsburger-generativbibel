// Versions- & Änderungs-Apparat (buchbezogen, mit KI-Modell + Grundtext + Zeitpunkt).
//
//   node _raw/version.js commit '<metaJSON>' [reasonsFile]
//   node _raw/version.js list
//   node _raw/version.js rebuild
//
// metaJSON = { "book":"markus", "label":"Qualitäts-Audit",
//              "model":"Claude Opus 4.8",
//              "baseText":"Tischendorf, Novum Testamentum Graece, 8. Ausgabe",
//              "source":"…", "timestamp":"<ISO, optional>" }
//
// "commit" nimmt data/books/<book>.json, legt history/<book>_vN.json an, vergleicht mit
// der Vorversion DIESES Buches und schreibt jede Text-Änderung (Stelle, Stufe, vorher→
// nachher, Grund, Schweregrad, Zeitpunkt, Modell, Grundtext) nach history/changes.json.
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const HDIR = path.join(BASE, 'history');
fs.mkdirSync(HDIR, { recursive: true });

const versionsPath = path.join(HDIR, 'versions.json');
const changesPath = path.join(HDIR, 'changes.json');
const load = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; } };

let versions = load(versionsPath, []);
let changes = load(changesPath, []);

function rebuildAppHistory() {
  fs.writeFileSync(path.join(BASE, 'data/history.json'), JSON.stringify({ versions, changes }), 'utf8');
}
function verseKeys(chap) { return Object.keys(chap).filter((k) => /^\d+$/.test(k)); }

const cmd = process.argv[2];

if (cmd === 'commit') {
  let m;
  try { m = JSON.parse(process.argv[3]); } catch (e) { console.error('metaJSON ungültig: ' + e.message); process.exit(1); }
  if (!m.book) { console.error('metaJSON braucht "book".'); process.exit(1); }
  const reasonsArg = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : null;
  const reasons = reasonsArg ? load(path.resolve(reasonsArg), {}) : {};
  const ts = m.timestamp || new Date().toISOString();
  const model = m.model || '(unbekannt)';
  const baseText = m.baseText || '(unbekannt)';

  const cur = load(path.join(BASE, 'data/books/' + m.book + '.json'), null);
  if (!cur) { console.error('data/books/' + m.book + '.json fehlt – erst assemble.js laufen lassen.'); process.exit(1); }

  // Versionsnummer DIESES Buches
  const bookVersions = versions.filter((v) => v.book === m.book);
  const id = bookVersions.length ? Math.max(...bookVersions.map((v) => v.id)) + 1 : 1;
  const prevVer = bookVersions.length ? bookVersions[bookVersions.length - 1] : null;

  const diffs = [];
  if (prevVer) {
    const prev = load(path.join(HDIR, m.book + '_v' + prevVer.id + '.json'), null);
    if (prev) {
      const allCh = new Set([...Object.keys(prev.chapters || {}), ...Object.keys(cur.chapters || {})].map(Number));
      for (const ch of [...allCh].sort((a, b) => a - b)) {
        const pc = (prev.chapters[ch]) || {}, cc = (cur.chapters[ch]) || {};
        const vs = new Set([...verseKeys(pc), ...verseKeys(cc)].map(Number));
        for (const v of [...vs].sort((a, b) => a - b)) {
          const pv = pc[v] || {}, cv = cc[v] || {};
          if (pv.omitted || cv.omitted) continue;
          for (const lvl of ['l1', 'l2', 'l3']) {
            const o = pv[lvl] || '', n = cv[lvl] || '';
            if (o !== n) {
              const r = reasons[ch + ':' + v + ':' + lvl] || {};
              diffs.push({ book: m.book, version: id, timestamp: ts, model, baseText, ch, v, ref: ch + ',' + v, level: lvl, old: o, new: n, reason: r.reason || '', severity: r.severity || '' });
            }
          }
        }
      }
    }
  }

  fs.copyFileSync(path.join(BASE, 'data/books/' + m.book + '.json'), path.join(HDIR, m.book + '_v' + id + '.json'));

  let vc = 0;
  for (const ch in cur.chapters) { const c = cur.chapters[ch]; vc += verseKeys(c).filter((k) => !c[k].omitted).length; }

  versions.push({ book: m.book, id, label: m.label || ('Version ' + id), model, baseText, source: m.source || '', timestamp: ts, verseCount: vc, changeCount: diffs.length, baseline: !prevVer });
  changes = changes.concat(diffs);
  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 1), 'utf8');
  fs.writeFileSync(changesPath, JSON.stringify(changes, null, 1), 'utf8');
  rebuildAppHistory();
  console.log('committed ' + m.book + ' v' + id + ' "' + (m.label || '') + '" | ' + ts + ' | Modell: ' + model + ' | Grundtext: ' + baseText + ' | Änderungen: ' + diffs.length + ' | Verse: ' + vc);
} else if (cmd === 'rebuild') {
  rebuildAppHistory();
  console.log('data/history.json neu gebaut (' + versions.length + ' Versionen, ' + changes.length + ' Änderungen).');
} else if (cmd === 'list') {
  if (!versions.length) console.log('(noch keine Versionen)');
  for (const v of versions) console.log(v.book + ' v' + v.id + '  ' + v.timestamp + '  ' + v.label + '  [' + v.model + ' · ' + v.baseText + ']  (' + v.changeCount + ' Änd., ' + v.verseCount + ' Verse)');
} else {
  console.log('Befehle:\n  commit \'<metaJSON>\' [reasonsFile|-]\n  list\n  rebuild');
}
