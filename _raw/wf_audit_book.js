export const meta = {
  name: 'evangelium-audit',
  description: 'Zweiter, unabhängiger Qualitäts-Audit eines Evangeliums (per args) gegen den Urtext: liefert gezielte Korrekturen je Vers/Stufe.',
  phases: [{ title: 'Audit', detail: 'Kapitel unabhängig gegen den Tischendorf-Text prüfen' }],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';
const A = (typeof args === 'string') ? JSON.parse(args) : (args || {});
const PREFIX = A.prefix;
const NAME = A.name;
const NCH = A.chapters;
const pad = (n) => String(n).padStart(2, '0');

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    ch: { type: 'integer' },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { v: { type: 'integer' }, level: { type: 'string' }, new: { type: 'string' }, reason: { type: 'string' }, severity: { type: 'string' } },
        required: ['v', 'level', 'new', 'reason'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['ch', 'corrections'],
};

function auditPrompt(ch) {
  const nn = pad(ch);
  return (
    'Du bist ein unabhängiger, sehr strenger Qualitätsprüfer für die deutsche Übersetzung des EVANGELIUMS NACH ' + NAME.toUpperCase() + ', Kapitel ' + ch + '. ' +
    'Du prüfst eine FERTIGE Übersetzung (3 Stufen je Vers) gegen den griechischen Urtext und schlägst nur dort Korrekturen vor, wo es WIRKLICH nötig ist.\n\n' +
    'Lies VOLLSTÄNDIG:\n' +
    '1. ' + BASE + '/_raw/style_spec.md\n' +
    '2. ' + BASE + '/_raw/glossary.md\n' +
    '3. ' + BASE + '/_raw/ch/' + PREFIX + '_' + nn + '.txt   — griechischer Urtext (Tischendorf), je Zeile "Vers<TAB>Griechisch".\n' +
    '4. ' + BASE + '/_raw/out_' + PREFIX + '/' + PREFIX + '_' + nn + '.json — die aktuelle Übersetzung {chapter, verses:[{v,l1,l2,l3}]}.\n\n' +
    'Prüfe jeden Vers und jede Stufe auf ECHTE Mängel:\n' +
    '- GENAUIGKEIT: Übersetzungsfehler, Sinnentstellung, ausgelassene/hinzugefügte Inhalte (l1/l2 streng; l3 darf verdeutlichen, nichts inhaltlich Fremdes).\n' +
    '- REGISTER: l1 nicht wörtlich genug (Wortstellung, historisches Präsens, Parataxe, Partizipien)? l3 zu „kirchlich"/zu kompliziert? l2 unsauber?\n' +
    '- KONSISTENZ: Begriffe/Eigennamen gemäß glossary.md.\n' +
    '- DEUTSCH: Grammatik-, Rechtschreib-, Flüssigkeitsfehler.\n\n' +
    'WICHTIG: Schlage NUR Änderungen vor, die einen echten Mangel beheben — KEINE bloßen Geschmacks-Umformulierungen. ' +
    'Bei einer Korrektur gib den VOLLSTÄNDIGEN neuen Text der Stufe an (Feld „new"), dazu „level" (l1|l2|l3), „v", knappe „reason", „severity" (hoch|mittel|niedrig). ' +
    'Bleibe strikt im Stil der Stufe und im Glossar.\n\n' +
    'Gib zurück: { ch:' + ch + ', corrections:[…], summary:"kurzer Gesamteindruck" }. Wenn alles in Ordnung ist: corrections leer.'
  );
}

const chapters = Array.from({ length: NCH }, (_, i) => i + 1);
log('Unabhängiger Qualitäts-Audit ' + NAME + ' 1–' + NCH + ' …');

const results = await parallel(
  chapters.map((ch) => () => agent(auditPrompt(ch), { label: 'audit ' + PREFIX + ' ' + ch, phase: 'Audit', schema: AUDIT_SCHEMA }))
);

const ok = results.filter(Boolean);
let total = 0;
const perChapter = ok.map((r) => { total += (r.corrections || []).length; return { ch: r.ch, corrections: r.corrections || [], summary: r.summary || '' }; });
log(NAME + '-Audit fertig. Kapitel: ' + ok.length + '/' + NCH + ', Korrekturen: ' + total);
return { book: PREFIX, chaptersAudited: ok.length, totalCorrections: total, perChapter };
