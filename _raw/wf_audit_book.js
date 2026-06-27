export const meta = {
  name: 'evangelium-audit',
  description: 'Zweiter, unabhaengiger Qualitaets-Audit eines Buches (per args) gegen den Urtext: Korrekturen vorschlagen, adversarial gegenpruefen, je Kapitel sofort speichern (abbruchsicher).',
  phases: [
    { title: 'Audit', detail: 'Kapitel unabhängig gegen den Tischendorf-Text prüfen' },
    { title: 'Gegenprüfung', detail: 'jede Korrektur adversarial verifizieren + speichern' },
  ],
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
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    ch: { type: 'integer' },
    proposedCount: { type: 'integer' },
    acceptedCount: { type: 'integer' },
    rejected: { type: 'array', items: { type: 'object', properties: { v: { type: 'integer' }, level: { type: 'string' }, why: { type: 'string' } } } },
    saved: { type: 'boolean' },
  },
  required: ['ch', 'acceptedCount', 'saved'],
};

const srcBlock = (nn) =>
  'Lies VOLLSTÄNDIG:\n' +
  '1. ' + BASE + '/_raw/style_spec.md\n' +
  '2. ' + BASE + '/_raw/glossary.md\n' +
  '3. ' + BASE + '/_raw/ch/' + PREFIX + '_' + nn + '.txt   — griechischer Urtext (Tischendorf), je Zeile "Vers<TAB>Griechisch".\n' +
  '4. ' + BASE + '/_raw/out_' + PREFIX + '/' + PREFIX + '_' + nn + '.json — die aktuelle Übersetzung {chapter, verses:[{v,l1,l2,l3}]}.\n';

function auditPrompt(ch) {
  const nn = pad(ch);
  return (
    'Du bist ein unabhängiger, sehr strenger Qualitätsprüfer für die deutsche Übersetzung von „' + NAME + '", Kapitel ' + ch + '. ' +
    'Du prüfst eine FERTIGE Übersetzung (3 Stufen je Vers) gegen den griechischen Urtext und schlägst nur dort Korrekturen vor, wo es WIRKLICH nötig ist.\n\n' +
    srcBlock(nn) +
    '\nPrüfe jeden Vers und jede Stufe auf ECHTE Mängel:\n' +
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

function verifyPrompt(ch, audit) {
  const nn = pad(ch);
  const proposed = (audit && audit.corrections) || [];
  return (
    'Du bist ein ZWEITER, unabhängiger Gegenprüfer (Lektor) für „' + NAME + '", Kapitel ' + ch + '. ' +
    'Ein erster Prüfer hat Korrekturen vorgeschlagen. Deine Aufgabe: jede einzeln gegen den Urtext und die aktuelle Übersetzung verifizieren und NUR die berechtigten, korrekten in die finale Audit-Datei schreiben.\n\n' +
    srcBlock(nn) +
    '\nVorgeschlagene Korrekturen (JSON):\n' + JSON.stringify(proposed) +
    '\n\nFür JEDE vorgeschlagene Korrektur:\n' +
    '- AKZEPTIEREN nur, wenn sie einen ECHTEN Mangel behebt UND der neue Text korrekt, registergerecht (l1 wörtlich/konkordant · l2 genau+natürlich · l3 einfaches Alltagsdeutsch) und glossarkonform ist.\n' +
    '- VERWERFEN, wenn es nur Geschmack ist, der alte Text bereits korrekt war, oder der Vorschlag den Vers verschlechtert/verfälscht.\n' +
    '- Du darfst den „new"-Text einer akzeptierten Korrektur minimal nachbessern (Tippfehler, Glossar, Register), ohne den Sinn zu ändern.\n' +
    '- Im Zweifel gegen eine Änderung entscheiden (lieber den geprüften Bestand behalten als eine unsichere Änderung einbauen).\n\n' +
    'DANACH ZWINGEND: Schreibe die AKZEPTIERTEN Korrekturen mit dem Write-Tool als JSON nach:\n' +
    '  ' + BASE + '/_raw/audit_' + PREFIX + '/' + PREFIX + '_' + nn + '.json\n' +
    'Exaktes Format (valides JSON): {"chapter": ' + ch + ', "corrections": [{"v":N,"level":"l1|l2|l3","new":"…vollständiger neuer Text…","reason":"…","severity":"hoch|mittel|niedrig"}], "summary":"kurzer Gesamteindruck"}\n' +
    'Wenn KEINE Korrektur berechtigt ist: schreibe die Datei mit "corrections": []. ' +
    'Deutsche Anführungszeichen „ " im Text (kein Escaping); JSON-Strings mit doppelten Anführungszeichen. Datei MUSS valides JSON sein.\n\n' +
    'Gib als strukturierte Antwort NUR zurück: {ch, proposedCount, acceptedCount, rejected:[{v,level,why}], saved:true}.'
  );
}

// Arbeitsliste: args.todo (Kapitelzahlen) -> nur diese; sonst 1..NCH
let chapters;
if (Array.isArray(A.todo) && A.todo.length) chapters = A.todo.map(Number);
else chapters = Array.from({ length: NCH }, (_, i) => i + 1);

log('Qualitäts-Audit ' + NAME + ': ' + chapters.length + ' Kapitel — prüfen → adversarial gegenprüfen → je Kapitel sofort speichern.');

const results = await pipeline(
  chapters,
  (ch) => agent(auditPrompt(ch), { label: 'audit ' + PREFIX + ' ' + ch, phase: 'Audit', schema: AUDIT_SCHEMA }).then((a) => ({ ch, audit: a })),
  (prev, ch) => {
    const c = (prev && prev.ch) || ch;
    return agent(verifyPrompt(c, prev && prev.audit), { label: 'gegenprüfen+speichern ' + PREFIX + ' ' + c, phase: 'Gegenprüfung', schema: VERIFY_SCHEMA })
      .then((v) => (v ? { ch: c, proposedCount: v.proposedCount || 0, acceptedCount: v.acceptedCount || 0, saved: !!v.saved } : null));
  }
);

const ok = results.filter(Boolean);
let proposed = 0, accepted = 0;
for (const r of ok) { proposed += r.proposedCount || 0; accepted += r.acceptedCount || 0; }
log(NAME + '-Audit fertig. Kapitel: ' + ok.length + '/' + chapters.length + ' | vorgeschlagen: ' + proposed + ', akzeptiert: ' + accepted);
return { book: PREFIX, chaptersAudited: ok.length, requested: chapters.length, proposed, accepted, perChapter: ok };
