// Erzeugt data/manifest.json: Katalog aller 27 NT-Bücher + Verfügbarkeit + neueste Version je Buch.
// Aufruf: node _raw/build_manifest.js
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

const catalog = JSON.parse(fs.readFileSync(path.join(BASE, 'data/nt_books.json'), 'utf8'));
let history = { versions: [], changes: [] };
try { history = JSON.parse(fs.readFileSync(path.join(BASE, 'data/history.json'), 'utf8')); } catch (e) {}

function latestVersion(bookId) {
  const vs = (history.versions || []).filter((v) => v.book === bookId);
  if (!vs.length) return null;
  const last = vs[vs.length - 1];
  return { id: last.id, label: last.label, timestamp: last.timestamp, model: last.model, baseText: last.baseText };
}

const books = catalog.map((b) => {
  const file = path.join(BASE, 'data/books/' + b.id + '.json');
  const available = fs.existsSync(file);
  let verseCount = null;
  if (available) {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      verseCount = 0;
      for (const ch in d.chapters) for (const v in d.chapters[ch]) if (/^\d+$/.test(v) && !d.chapters[ch][v].omitted) verseCount++;
    } catch (e) {}
  }
  return { id: b.id, name: b.name, short: b.short, chapters: b.chapters, available, verseCount, latest: latestVersion(b.id) };
});

const manifest = {
  title: 'Neues Testament in drei Stufen',
  baseTextDefault: 'Tischendorf, Novum Testamentum Graece, 8. Ausgabe',
  available: books.filter((b) => b.available).map((b) => b.id),
  books,
};

fs.writeFileSync(path.join(BASE, 'data/manifest.json'), JSON.stringify(manifest), 'utf8');
console.log('manifest.json: ' + books.filter((b) => b.available).length + '/' + books.length + ' Bücher verfügbar (' + manifest.available.join(', ') + ')');
