export const meta = {
  name: 'at-buch-uebersetzen',
  description: 'Ein AT-Buch (per args: prefix/name/chapters/todo) in ZWEI deutschen Fassungen (Urtextnah + fließend) aus dem hebraeischen Urtext (WLC/OSHB): uebersetzen, adversarial pruefen, korrigieren, je Kapitel sofort speichern.',
  phases: [
    { title: 'Übersetzen', detail: '2 Fassungen aus dem hebräischen Urtext' },
    { title: 'Prüfen', detail: 'adversariale Kontrolle gegen den Urtext' },
    { title: 'Korrigieren', detail: 'Korrektur + finale Speicherung je Kapitel' },
  ],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';
const A = (typeof args === 'string') ? JSON.parse(args) : (args || {});
const PREFIX = A.prefix;
const NAME = A.name;
const NCH = A.chapters || 0;
const pad = (n) => String(n).padStart(2, '0');

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: { verses: { type: 'array', items: { type: 'object', properties: { v: { type: 'integer' }, l1: { type: 'string' }, l3: { type: 'string' } }, required: ['v', 'l1', 'l3'] } } },
  required: ['verses'],
};
const VERIFY_SCHEMA = {
  type: 'object',
  properties: { overallOk: { type: 'boolean' }, issues: { type: 'array', items: { type: 'object', properties: { v: { type: 'integer' }, level: { type: 'string' }, problem: { type: 'string' }, suggestion: { type: 'string' }, severity: { type: 'string' } }, required: ['v', 'level', 'problem', 'suggestion'] } } },
  required: ['overallOk', 'issues'],
};
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: { ch: { type: 'integer' }, verseCount: { type: 'integer' }, fixedCount: { type: 'integer' }, ok: { type: 'boolean' } },
  required: ['ch', 'verseCount', 'ok'],
};

const filesBlock = (nn) =>
  'Lies zuerst diese Dateien VOLLSTÄNDIG:\n' +
  '1. ' + BASE + '/_raw/style_spec_at.md  — verbindliche Stilregeln der 2 Fassungen (AT).\n' +
  '2. ' + BASE + '/_raw/glossary_at.md     — verbindliche Begriffs-Wiedergaben (Konsistenz).\n' +
  '3. ' + BASE + '/_raw/ch/' + PREFIX + '_' + nn + '.txt  — hebräischer Urtext (WLC/OSHB), eine Zeile je Vers: "Versnummer<TAB>Hebräisch" (rechts-nach-links, mit Vokalen/Akzenten).\n';

function translatePrompt(ch) {
  const nn = pad(ch);
  return (
    'Du bist Experte für biblisches Hebräisch und exzellenter deutscher Übersetzer. ' +
    'Erstelle für „' + NAME + '", Kapitel ' + ch + ', zu JEDEM Vers ZWEI deutsche Fassungen direkt aus dem hebräischen Urtext.\n\n' +
    filesBlock(nn) +
    '\nAufgabe:\n' +
    '- Übersetze JEDEN Vers der Datei (auch die Überschrift, die im masoretischen Text Vers 1 ist).\n' +
    '- Halte dich strikt an style_spec_at.md und glossary_at.md.\n' +
    '- l1 (URTEXTNAH): sehr wörtlich/konkordant; hebräische Wortstellung und Parataxe beibehalten; Bildsprache wörtlich (Fels, Horn, Hand …); Parallelismus erhalten.\n' +
    '- l3 (FLIESSEND): heutiges, klares Alltagsdeutsch, gut vorlesbar; treu, aber frei; nichts inhaltlich Fremdes hinzufügen.\n' +
    '- Es gibt KEINE Mittelstufe: setze l1 und l3 bewusst deutlich voneinander ab (l1 wirklich nah, l3 wirklich frei).\n' +
    '- JHWH → „der HERR" (beide Fassungen); „Sela" unübersetzt lassen.\n' +
    '- Keine Versnummern im Text, keine eckigen Klammern, keine Fußnoten.\n\n' +
    'Gib NUR strukturierte Daten zurück: verses[] mit {v, l1, l3}. Kein Vers darf fehlen.'
  );
}
function verifyPrompt(ch, translation) {
  const nn = pad(ch);
  return (
    'Du bist ein STRENGER, adversarialer Prüfer für Bibelübersetzungen (biblisches Hebräisch → Deutsch). ' +
    'Prüfe die folgende Übersetzung von „' + NAME + '" Kapitel ' + ch + ' GEGEN den hebräischen Urtext.\n\n' +
    filesBlock(nn) +
    '\nZu prüfende Übersetzung (JSON, je Vers l1/l3):\n' + JSON.stringify(translation.verses) +
    '\n\nPrüfe JEDEN Vers und BEIDE Fassungen streng auf:\n' +
    '- GENAUIGKEIT: Übersetzungsfehler, Sinnentstellung, falsche Bezüge, ausgelassene/hinzuerfundene Inhalte (l1 streng wörtlich; l3 darf verdeutlichen, nichts Fremdes).\n' +
    '- REGISTER/ABSTAND: l1 wirklich urtextnah (Wortstellung, Parallelismus, wörtliche Bilder)? l3 wirklich flüssiges Alltagsdeutsch? Sind beide klar voneinander abgesetzt (keine zwei Mittelfassungen)?\n' +
    '- HEBRÄISCH-SPEZIFISCH: JHWH = „der HERR"? „Sela" stehen gelassen? Überschrift (Vers 1) übersetzt? Eigennamen korrekt?\n' +
    '- GLOSSAR/KONSISTENZ und DEUTSCH (Grammatik/Rechtschreibung/Flüssigkeit, poetische Würde).\n\n' +
    'Melde ALLE Probleme als issues[] mit {v, level (l1|l3), problem, suggestion, severity (hoch|mittel|niedrig)}. Im Zweifel melden. Wenn alles gut ist: overallOk=true und issues leer.'
  );
}
function repairPrompt(ch, translation, issues) {
  const nn = pad(ch);
  return (
    'Du bist Lektor/Korrektor der deutschen Übersetzung von „' + NAME + '", Kapitel ' + ch + '. Erstelle die ENDGÜLTIGE, korrigierte Fassung und SPEICHERE sie.\n\n' +
    filesBlock(nn) +
    '\nAktuelle Übersetzung (JSON):\n' + JSON.stringify(translation.verses) +
    '\n\nGemeldete Probleme (JSON):\n' + JSON.stringify(issues) +
    '\n\nAufgabe:\n' +
    '- Behebe alle BERECHTIGTEN Probleme (prüfe sie kurz gegen den Urtext; klar falsche Meldungen darfst du begründet ignorieren).\n' +
    '- Achte erneut strikt auf style_spec_at.md (l1 urtextnah, l3 fließend, deutlich abgesetzt) und glossary_at.md (JHWH→„der HERR", Sela, Konsistenz).\n' +
    '- Liefere für JEDEN Vers die finale Fassung {v, l1, l3}.\n\n' +
    'DANACH ZWINGEND: Schreibe die finale Fassung mit dem Write-Tool als Datei nach:\n' +
    '  ' + BASE + '/_raw/out_' + PREFIX + '/' + PREFIX + '_' + nn + '.json\n' +
    'Exaktes Format (gültiges JSON): {"chapter": ' + ch + ', "verses": [{"v":1,"l1":"…","l3":"…"}, …]}\n' +
    'KRITISCH für gültiges JSON: Verwende INNERHALB der Textwerte (l1, l3) NIEMALS das doppelte Anführungszeichen. Für Zitate/Hervorhebungen im Text einfache Anführungszeichen oder gar keine. Doppelte Anführungszeichen NUR als JSON-Begrenzer. UTF-8; deutsche Umlaute sind erlaubt. Datei MUSS valides JSON sein und alle Verse enthalten.\n\n' +
    'Gib als strukturierte Antwort NUR eine Zusammenfassung zurück: {ch, verseCount, fixedCount, ok}.'
  );
}

// Arbeitsliste: args.todo (Kapitelzahlen) -> nur diese; sonst 1..NCH
let chapters;
if (Array.isArray(A.todo) && A.todo.length) chapters = A.todo.map(Number);
else chapters = Array.from({ length: NCH }, (_, i) => i + 1);

log('Übersetze ' + NAME + ': ' + chapters.length + ' Kapitel (2 Fassungen) — übersetzen → adversarial prüfen → korrigieren (je Kapitel sofort gespeichert).');

const results = await pipeline(
  chapters,
  (ch) => agent(translatePrompt(ch), { label: 'übersetzen ' + PREFIX + ' ' + ch, phase: 'Übersetzen', schema: TRANSLATE_SCHEMA }).then((tr) => ({ ch, translation: tr })),
  (prev, ch) => {
    const c = (prev && prev.ch) || ch;
    if (!prev || !prev.translation) return null;
    return agent(verifyPrompt(c, prev.translation), { label: 'prüfen ' + PREFIX + ' ' + c, phase: 'Prüfen', schema: VERIFY_SCHEMA })
      .then((v) => ({ ch: c, translation: prev.translation, issues: (v && v.issues) || [], overallOk: v ? v.overallOk : true }));
  },
  (prev, ch) => {
    const c = (prev && prev.ch) || ch;
    if (!prev || !prev.translation) return null;
    return agent(repairPrompt(c, prev.translation, prev.issues), { label: 'korrigieren+speichern ' + PREFIX + ' ' + c, phase: 'Korrigieren', schema: SUMMARY_SCHEMA })
      .then((s) => (s ? { ch: c, verseCount: s.verseCount, fixedCount: s.fixedCount, ok: s.ok } : null));
  }
);

const ok = results.filter(Boolean);
log(NAME + ' fertig. Kapitel verarbeitet: ' + ok.length + '/' + chapters.length + '.');
return { book: PREFIX, chaptersProcessed: ok.length, total: chapters.length, perChapter: ok };
