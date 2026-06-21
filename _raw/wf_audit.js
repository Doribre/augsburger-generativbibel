export const meta = {
  name: 'markus-audit',
  description: 'Zweiter, unabhängiger Qualitäts-Audit der deutschen Markus-Übersetzung (16 Kap.) gegen den Urtext: liefert gezielte Korrekturen je Vers/Stufe.',
  phases: [{ title: 'Audit', detail: '16 Kapitel unabhängig gegen den Tischendorf-Text prüfen' }],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';
const pad = (n) => String(n).padStart(2, '0');

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    ch: { type: 'integer' },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          v: { type: 'integer' },
          level: { type: 'string' },
          new: { type: 'string' },
          reason: { type: 'string' },
          severity: { type: 'string' },
        },
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
    'Du bist ein unabhängiger, sehr strenger Qualitätsprüfer für die deutsche Übersetzung des MARKUSEVANGELIUMS, Kapitel ' + ch + '. ' +
    'Du prüfst eine FERTIGE Übersetzung (3 Stufen je Vers) gegen den griechischen Urtext und schlägst nur dort Korrekturen vor, wo es WIRKLICH nötig ist.\n\n' +
    'Lies VOLLSTÄNDIG:\n' +
    '1. ' + BASE + '/_raw/style_spec.md   — die Stilregeln (l1 wörtlich, l2 mittel, l3 Alltagssprache).\n' +
    '2. ' + BASE + '/_raw/glossary.md      — verbindliche Begriffe/Eigennamen.\n' +
    '3. ' + BASE + '/_raw/ch/mk_' + nn + '.txt   — griechischer Urtext (Tischendorf), je Zeile "Vers<TAB>Griechisch".\n' +
    '4. ' + BASE + '/_raw/out/mk_' + nn + '.json — die aktuelle Übersetzung {chapter, verses:[{v,l1,l2,l3}]}.\n\n' +
    'Prüfe jeden Vers und jede Stufe auf ECHTE Mängel:\n' +
    '- GENAUIGKEIT: Übersetzungsfehler, Sinnentstellung, ausgelassene/hinzugefügte Inhalte (l1/l2 streng; l3 darf verdeutlichen, aber nichts inhaltlich Fremdes).\n' +
    '- REGISTER: l1 nicht wörtlich genug (Wortstellung, historisches Präsens, Parataxe, Partizipien)? l3 zu „kirchlich"/zu kompliziert statt Alltagssprache? l2 unsauber?\n' +
    '- KONSISTENZ: Begriffe/Eigennamen entgegen glossary.md oder uneinheitlich.\n' +
    '- DEUTSCH: Grammatik-, Rechtschreib-, Flüssigkeitsfehler.\n\n' +
    'WICHTIG:\n' +
    '- Schlage NUR Änderungen vor, die einen echten Mangel beheben — KEINE bloßen Geschmacks-Umformulierungen.\n' +
    '- Bei einer Korrektur gib den VOLLSTÄNDIGEN neuen Text der betreffenden Stufe an (Feld „new"), dazu „level" (l1|l2|l3), „v", knappe „reason" und „severity" (hoch|mittel|niedrig).\n' +
    '- Bleibe strikt im Stil der jeweiligen Stufe (style_spec) und im Glossar.\n\n' +
    'Gib zurück: { ch:' + ch + ', corrections:[…], summary:"kurzer Gesamteindruck" }. Wenn alles in Ordnung ist: corrections leer.'
  );
}

const chapters = Array.from({ length: 16 }, (_, i) => i + 1);
log('Unabhängiger Qualitäts-Audit Markus 1–16 …');

const results = await parallel(
  chapters.map((ch) => () =>
    agent(auditPrompt(ch), { label: 'audit Mk ' + ch, phase: 'Audit', schema: AUDIT_SCHEMA })
  )
);

const ok = results.filter(Boolean);
let totalCorr = 0;
const perChapter = ok.map((r) => {
  totalCorr += (r.corrections || []).length;
  return { ch: r.ch, corrections: r.corrections || [], summary: r.summary || '' };
});
log('Audit fertig. Kapitel: ' + ok.length + '/16, Korrekturen gesamt: ' + totalCorr);
return { chaptersAudited: ok.length, totalCorrections: totalCorr, perChapter };
