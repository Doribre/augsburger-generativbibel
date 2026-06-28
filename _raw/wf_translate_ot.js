export const meta = {
  name: 'at-buch-uebersetzen',
  description: 'Ein AT-Buch (args prefix/name/chapters/todo) in ZWEI Fassungen (Urtextnah+fliessend) aus dem hebraeischen Urtext (WLC/OSHB). CRASH-SICHER: jeder Schritt schreibt sofort auf die Platte; bereits Fertiges wird uebersprungen (tokensparend).',
  phases: [
    { title: 'Übersetzen', detail: 'übersetzen + SOFORT speichern (Entwurf)' },
    { title: 'Prüfen', detail: 'adversariale Kontrolle (liest Datei)' },
    { title: 'Korrigieren', detail: 'korrigieren + finale Speicherung' },
  ],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';
const A = (typeof args === 'string') ? JSON.parse(args) : (args || {});
const PREFIX = A.prefix;
const NAME = A.name;
const NCH = A.chapters || 0;
const pad = (n) => String(n).padStart(2, '0');
const OUT = (nn) => BASE + '/_raw/out_' + PREFIX + '/' + PREFIX + '_' + nn + '.json';

const T_SCHEMA = { type: 'object', properties: { ch: { type: 'integer' }, verseCount: { type: 'integer' }, skipped: { type: 'boolean' } }, required: ['ch'] };
const V_SCHEMA = { type: 'object', properties: { ch: { type: 'integer' }, overallOk: { type: 'boolean' }, skipped: { type: 'boolean' }, issues: { type: 'array', items: { type: 'object', properties: { v: { type: 'integer' }, level: { type: 'string' }, problem: { type: 'string' }, suggestion: { type: 'string' }, severity: { type: 'string' } }, required: ['v', 'level', 'problem', 'suggestion'] } } }, required: ['ch'] };
const S_SCHEMA = { type: 'object', properties: { ch: { type: 'integer' }, verseCount: { type: 'integer' }, fixedCount: { type: 'integer' }, ok: { type: 'boolean' } }, required: ['ch'] };

const QUOTE = 'KRITISCH für gültiges JSON: in den Textwerten (l1, l3) NIEMALS doppelte Anführungszeichen verwenden — für Zitate einfache \' oder gar keine; doppelte nur als JSON-Begrenzer. UTF-8, Umlaute erlaubt. Datei MUSS valides JSON sein und alle Verse enthalten.';
const refs = (nn) => 'Bezugsdateien: ' + BASE + '/_raw/style_spec_at.md (Stil), ' + BASE + '/_raw/glossary_at.md (Glossar), ' + BASE + '/_raw/ch/' + PREFIX + '_' + nn + '.txt (hebräischer Urtext, je Zeile "Vers<TAB>Hebräisch").';

function translatePrompt(ch) {
  const nn = pad(ch);
  return (
    'Du bist Experte für biblisches Hebräisch und exzellenter deutscher Übersetzer. Aufgabe: „' + NAME + '" Kapitel ' + ch + ', je Vers ZWEI Fassungen (l1 Urtextnah, l3 fließend).\n\n' +
    'SCHRITT 0 (Token sparen): Lies mit dem Read-Tool ' + OUT(nn) + '. Existiert die Datei und hat sie für JEDEN Vers nicht-leeres l1 UND l3, dann übersetze NICHT neu — gib sofort {ch:' + ch + ', verseCount:<Anzahl>, skipped:true} zurück.\n\n' +
    'Sonst: Lies ' + refs(nn) + '\n' +
    '- Übersetze JEDEN Vers (auch die Überschrift = Vers 1). Strikt nach style_spec_at.md + glossary_at.md.\n' +
    '- l1 sehr wörtlich/konkordant (hebr. Wortstellung, Parallelismus, Bilder wörtlich); l3 heutiges, klares Alltagsdeutsch. KEINE Mittelstufe: l1 und l3 deutlich absetzen. JHWH → „der HERR"; „Sela" stehen lassen. Keine Versnummern/Klammern.\n\n' +
    'DANACH ZWINGEND SOFORT mit dem Write-Tool speichern nach ' + OUT(nn) + ' im Format: {"chapter":' + ch + ',"verses":[{"v":1,"l1":"…","l3":"…"}, …],"stage":"draft"}\n' + QUOTE + '\n' +
    'Gib zurück: {ch:' + ch + ', verseCount:<Anzahl>}.'
  );
}
function verifyPrompt(ch) {
  const nn = pad(ch);
  return (
    'Du bist ein STRENGER, adversarialer Prüfer (biblisches Hebräisch → Deutsch) für „' + NAME + '" Kapitel ' + ch + '.\n' +
    'Lies mit dem Read-Tool ' + OUT(nn) + '. Ist das Feld "stage" bereits "final", gib sofort {ch:' + ch + ', overallOk:true, issues:[], skipped:true} zurück (schon geprüft).\n\n' +
    'Sonst prüfe die dortige Übersetzung (l1/l3) GEGEN den Urtext. Lies dazu ' + refs(nn) + '\n' +
    'Prüfe je Vers/Fassung: GENAUIGKEIT (Fehler/Sinnentstellung/Auslassung/Hinzufügung; l1 streng wörtlich, l3 treu-frei), ABSTAND (l1 wirklich urtextnah, l3 wirklich flüssig — keine zwei Mittelfassungen), HEBRÄISCH (JHWH=„der HERR", „Sela" belassen, Überschrift übersetzt), GLOSSAR/Konsistenz, DEUTSCH.\n' +
    'Gib {ch:' + ch + ', overallOk, issues:[{v, level(l1|l3), problem, suggestion, severity(hoch|mittel|niedrig)}]}. Im Zweifel melden.'
  );
}
function repairPrompt(ch, issues) {
  const nn = pad(ch);
  return (
    'Du bist Lektor/Korrektor für „' + NAME + '" Kapitel ' + ch + '. Erstelle die ENDGÜLTIGE Fassung und speichere sie.\n' +
    'Lies mit dem Read-Tool ' + OUT(nn) + ' (aktuelle Übersetzung) sowie ' + refs(nn) + '\n' +
    'Gemeldete Probleme (JSON): ' + JSON.stringify(issues) + '\n' +
    '- Behebe alle BERECHTIGTEN Probleme (kurz gegen den Urtext prüfen; klar falsche begründet ignorieren). Strikt nach style_spec_at.md + glossary_at.md (l1 urtextnah, l3 fließend, deutlich abgesetzt; JHWH→„der HERR", „Sela").\n' +
    'DANACH ZWINGEND mit dem Write-Tool die finale Fassung nach ' + OUT(nn) + ' schreiben: {"chapter":' + ch + ',"verses":[{"v":1,"l1":"…","l3":"…"}, …],"stage":"final"}\n' + QUOTE + '\n' +
    'Gib zurück: {ch:' + ch + ', verseCount, fixedCount, ok:true}.'
  );
}

let chapters;
if (Array.isArray(A.todo) && A.todo.length) chapters = A.todo.map(Number);
else chapters = Array.from({ length: NCH }, (_, i) => i + 1);

log('Übersetze ' + NAME + ': ' + chapters.length + ' Kapitel (2 Fassungen, crash-sicher: je Schritt sofort gespeichert, Fertiges wird übersprungen).');

const results = await pipeline(
  chapters,
  (ch) => agent(translatePrompt(ch), { label: 'übersetzen+speichern ' + PREFIX + ' ' + ch, phase: 'Übersetzen', schema: T_SCHEMA }).then((r) => ({ ch: (r && r.ch) || ch })),
  (prev, ch) => {
    const c = (prev && prev.ch) || ch;
    return agent(verifyPrompt(c), { label: 'prüfen ' + PREFIX + ' ' + c, phase: 'Prüfen', schema: V_SCHEMA })
      .then((v) => ({ ch: c, issues: (v && v.issues) || [], verifySkipped: !!(v && v.skipped) }));
  },
  (prev, ch) => {
    const c = (prev && prev.ch) || ch;
    if (prev && prev.verifySkipped) return { ch: c, skipped: true }; // schon final → kein Korrektur-Agent (Token sparen)
    return agent(repairPrompt(c, (prev && prev.issues) || []), { label: 'korrigieren+speichern ' + PREFIX + ' ' + c, phase: 'Korrigieren', schema: S_SCHEMA })
      .then((s) => (s ? { ch: c, fixedCount: s.fixedCount, ok: s.ok } : null));
  }
);

const ok = results.filter(Boolean);
log(NAME + ' fertig. Kapitel verarbeitet/übersprungen: ' + ok.length + '/' + chapters.length + '.');
return { book: PREFIX, chaptersProcessed: ok.length, total: chapters.length, perChapter: ok };
