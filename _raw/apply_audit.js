// Wendet Audit-Korrekturen auf <outDir>/<prefix>_NN.json an, schreibt Änderungsprotokoll + Begründungsdatei.
// Aufruf: node _raw/apply_audit.js <auditOutputFile> <outDir> <prefix> [reasonsOut]
const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..');

const [auditFile, outArg, prefix, reasonsArg] = process.argv.slice(2);
if (!auditFile || !outArg || !prefix) { console.error('Aufruf: node _raw/apply_audit.js <auditOutputFile> <outDir> <prefix> [reasonsOut]'); process.exit(1); }
const outDir = path.resolve(outArg);
const reasonsOut = reasonsArg ? path.resolve(reasonsArg) : path.join(BASE, '_raw/audit_reasons_' + prefix + '.json');

const raw = JSON.parse(fs.readFileSync(path.resolve(auditFile), 'utf8'));
const res = raw.result || raw;
const perChapter = res.perChapter || [];

let applied = 0, skipped = 0;
const log = [];
const reasons = {};
const bySev = { hoch: 0, mittel: 0, niedrig: 0, '?': 0 };

for (const chData of perChapter) {
  const ch = chData.ch;
  const nn = String(ch).padStart(2, '0');
  const file = path.join(outDir, prefix + '_' + nn + '.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { log.push('!! Kapitel ' + ch + ': Datei nicht lesbar (' + e.message + ')'); continue; }
  const byV = {};
  for (const v of data.verses) byV[v.v] = v;

  for (const c of (chData.corrections || [])) {
    const verse = byV[c.v];
    if (!verse || !['l1', 'l2', 'l3'].includes(c.level)) { skipped++; continue; }
    if (!c.new || c.new.trim() === '' || c.new.trim() === (verse[c.level] || '').trim()) { skipped++; continue; }
    const old = verse[c.level];
    verse[c.level] = c.new.trim();
    applied++;
    bySev[c.severity in bySev ? c.severity : '?']++;
    reasons[ch + ':' + c.v + ':' + c.level] = { reason: c.reason || '', severity: c.severity || '' };
    log.push('Mk/Buch ' + ch + ',' + c.v + ' [' + c.level + '] (' + (c.severity || '?') + ')\n   alt: ' + old + '\n   neu: ' + verse[c.level] + '\n   grund: ' + (c.reason || ''));
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 1), 'utf8');
}

fs.writeFileSync(reasonsOut, JSON.stringify(reasons, null, 1), 'utf8');
const header = '# Audit-Änderungsprotokoll (' + prefix + ')\n\nAngewendet: ' + applied + ' (übersprungen: ' + skipped + ')\n' +
  'Schweregrad: hoch=' + bySev.hoch + ', mittel=' + bySev.mittel + ', niedrig=' + bySev.niedrig + (bySev['?'] ? ', ohne=' + bySev['?'] : '') + '\n\n' +
  '## Gesamteindruck je Kapitel\n' + perChapter.map((c) => '- Kap. ' + c.ch + ': ' + (c.summary || '').replace(/\n/g, ' ')).join('\n') + '\n\n## Einzeländerungen\n\n';
fs.writeFileSync(path.join(BASE, '_raw/audit_changelog_' + prefix + '.md'), header + log.join('\n\n') + '\n', 'utf8');

console.log('apply_audit (' + prefix + '): angewendet ' + applied + ', übersprungen ' + skipped + ' | hoch ' + bySev.hoch + ' mittel ' + bySev.mittel + ' niedrig ' + bySev.niedrig);
console.log('Begründungen: ' + path.relative(BASE, reasonsOut) + ' | Protokoll: _raw/audit_changelog_' + prefix + '.md');
