// Sammelt die je Kapitel gespeicherten Audit-Dateien _raw/audit_<prefix>/<prefix>_NN.json
// zu einem Audit-Ergebnis (Format fuer apply_audit.js) und meldet fehlende/kaputte Kapitel.
// Aufruf: node _raw/audit_combine.js <prefix> <chapters> [resultOut]
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

const [prefix, nchArg, resultArg] = process.argv.slice(2);
if (!prefix || !nchArg) { console.error('Aufruf: node _raw/audit_combine.js <prefix> <chapters> [resultOut]'); process.exit(1); }
const NCH = Number(nchArg);
const dir = path.join(BASE, '_raw/audit_' + prefix);
const resultOut = resultArg ? path.resolve(resultArg) : path.join(BASE, '_raw/audit_result_' + prefix + '.json');

const perChapter = [];
const missing = [];
let totalCorr = 0;

for (let ch = 1; ch <= NCH; ch++) {
  const nn = String(ch).padStart(2, '0');
  const file = path.join(dir, prefix + '_' + nn + '.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { missing.push(ch); continue; }
  if (!Array.isArray(data.corrections)) { missing.push(ch); continue; }
  // nur valide Korrekturen behalten
  const corr = data.corrections.filter((c) => c && Number.isInteger(c.v) && ['l1', 'l2', 'l3'].includes(c.level) && typeof c.new === 'string' && c.new.trim());
  totalCorr += corr.length;
  perChapter.push({ ch, corrections: corr, summary: data.summary || '' });
}

fs.writeFileSync(resultOut, JSON.stringify({ book: prefix, perChapter }, null, 1), 'utf8');

console.log('audit_combine (' + prefix + '): Kapitel vorhanden ' + perChapter.length + '/' + NCH + ', Korrekturen gesamt ' + totalCorr);
console.log('Ergebnis: ' + path.relative(BASE, resultOut));
if (missing.length) {
  console.log('FEHLEN/kaputt: ' + missing.join(', '));
  console.log('TODO_JSON=' + JSON.stringify(missing));
} else {
  console.log('VOLLSTÄNDIG — bereit für apply_audit.');
  console.log('TODO_JSON=[]');
}
