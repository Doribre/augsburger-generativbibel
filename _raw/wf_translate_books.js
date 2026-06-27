export const meta = {
  name: 'nt-restbuecher-uebersetzen',
  description: 'Mehrere NT-Buecher (args.books) in 3 deutschen Stufen aus dem Tischendorf-Griechisch: uebersetzen, adversarial pruefen, korrigieren, je Kapitel als JSON speichern.',
  phases: [
    { title: 'Übersetzen', detail: '3 Stufen aus dem Tischendorf-Griechisch' },
    { title: 'Prüfen', detail: 'adversariale Kontrolle gegen den Urtext' },
    { title: 'Korrigieren', detail: 'Korrektur + finale Speicherung je Kapitel' },
  ],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';
const A = (typeof args === 'string') ? JSON.parse(args) : (args || {});
const BOOKS = A.books || [];        // [{prefix, name, chapters}]
const pad = (n) => String(n).padStart(2, '0');

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: { verses: { type: 'array', items: { type: 'object', properties: { v: { type: 'integer' }, l1: { type: 'string' }, l2: { type: 'string' }, l3: { type: 'string' } }, required: ['v', 'l1', 'l2', 'l3'] } } },
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

const filesBlock = (prefix, nn) =>
  'Lies zuerst diese Dateien VOLLSTÄNDIG:\n' +
  '1. ' + BASE + '/_raw/style_spec.md  — verbindliche Stilregeln der 3 Stufen.\n' +
  '2. ' + BASE + '/_raw/glossary.md     — verbindliche Begriffs-Wiedergaben (Konsistenz).\n' +
  '3. ' + BASE + '/_raw/ch/' + prefix + '_' + nn + '.txt  — griechischer Urtext (Tischendorf), eine Zeile je Vers: "Versnummer<TAB>Griechisch".\n';

function translatePrompt(name, prefix, ch) {
  const nn = pad(ch);
  return (
    'Du bist Experte für Koine-Griechisch und exzellenter deutscher Übersetzer. ' +
    'Erstelle für den BIBELTEXT „' + name + '", Kapitel ' + ch + ', zu JEDEM Vers DREI deutsche Fassungen.\n\n' +
    filesBlock(prefix, nn) +
    '\nAufgabe:\n' +
    '- Übersetze JEDEN Vers der Datei. Verse, die als [OMITTED] markiert sind, KOMPLETT überspringen.\n' +
    '- Halte dich strikt an style_spec.md und glossary.md.\n' +
    '- l1 (GANZ NAH AM URTEXT): sehr wörtlich/konkordant; griechische Wortstellung, historisches Präsens und Parataxe beibehalten; Partizipien wörtlich.\n' +
    '- l2 (MITTEL): genau, aber natürliches, flüssiges Deutsch.\n' +
    '- l3 (GANZ FREI): heutiges Alltagsdeutsch, sehr verständlich, kurze Sätze, Alltagswortschatz statt Kirchensprache; inhaltlich treu, nichts Fremdes hinzufügen.\n' +
    '- Keine Versnummern im Text, keine eckigen Klammern, keine Fußnoten.\n\n' +
    'Gib NUR strukturierte Daten zurück: verses[] mit {v, l1, l2, l3}. Kein nicht-[OMITTED]-Vers darf fehlen.'
  );
}
function verifyPrompt(name, prefix, ch, translation) {
  const nn = pad(ch);
  return (
    'Du bist ein STRENGER, adversarialer Prüfer für Bibelübersetzungen (Koine-Griechisch → Deutsch). ' +
    'Prüfe die folgende Übersetzung von „' + name + '" Kapitel ' + ch + ' GEGEN den griechischen Urtext.\n\n' +
    filesBlock(prefix, nn) +
    '\nZu prüfende Übersetzung (JSON, je Vers l1/l2/l3):\n' + JSON.stringify(translation.verses) +
    '\n\nPrüfe JEDEN Vers und JEDE Stufe streng auf:\n' +
    '- GENAUIGKEIT: Übersetzungsfehler, Sinnentstellung, falsche Bezüge, falsches Tempus/Modus.\n' +
    '- VOLLSTÄNDIGKEIT: nichts ausgelassen; in l1/l2 nichts frei Hinzuerfundenes. (l3 darf verdeutlichen, nichts inhaltlich Fremdes.)\n' +
    '- REGISTER: l1 wirklich wörtlich? l3 wirklich einfaches Alltagsdeutsch? l2 genau und natürlich?\n' +
    '- GLOSSAR/KONSISTENZ: Begriffe und Eigennamen gemäß glossary.md.\n' +
    '- DEUTSCH: Grammatik, Rechtschreibung, Flüssigkeit.\n\n' +
    'Melde ALLE Probleme als issues[] mit {v, level (l1|l2|l3), problem, suggestion, severity (hoch|mittel|niedrig)}. ' +
    'Im Zweifel melden. Wenn alles gut ist: overallOk=true und issues leer.'
  );
}
function repairPrompt(name, prefix, ch, translation, issues) {
  const nn = pad(ch);
  return (
    'Du bist Lektor/Korrektor der deutschen Übersetzung von „' + name + '", Kapitel ' + ch + '. Erstelle die ENDGÜLTIGE, korrigierte Fassung und SPEICHERE sie.\n\n' +
    filesBlock(prefix, nn) +
    '\nAktuelle Übersetzung (JSON):\n' + JSON.stringify(translation.verses) +
    '\n\nGemeldete Probleme (JSON):\n' + JSON.stringify(issues) +
    '\n\nAufgabe:\n' +
    '- Behebe alle BERECHTIGTEN Probleme (prüfe sie kurz gegen den Urtext; klar falsche Meldungen darfst du begründet ignorieren).\n' +
    '- Achte erneut strikt auf style_spec.md (l1 wörtlich, l2 mittel, l3 Alltagssprache) und glossary.md (Konsistenz).\n' +
    '- Liefere für JEDEN Vers (außer [OMITTED]) die finale Fassung {v, l1, l2, l3}.\n\n' +
    'DANACH ZWINGEND: Schreibe die finale Fassung mit dem Write-Tool als Datei nach:\n' +
    '  ' + BASE + '/_raw/out_' + prefix + '/' + prefix + '_' + nn + '.json\n' +
    'Exaktes Datei-Format (gültiges JSON): {"chapter": ' + ch + ', "verses": [{"v":1,"l1":"…","l2":"…","l3":"…"}, …]}\n' +
    'Deutsche Anführungszeichen „ " ‚ ' + "'" + ' im Text (kein Escaping nötig); JSON-Strings mit doppelten Anführungszeichen. Stelle sicher, dass die Datei valides JSON ist und alle Verse enthält.\n\n' +
    'Gib als strukturierte Antwort NUR eine Zusammenfassung zurück: {ch, verseCount, fixedCount, ok}.'
  );
}

// Arbeitsliste bauen: args.todo [{prefix,chapter}] -> nur diese; sonst alle Kapitel aller Bücher
let items = [];
if (Array.isArray(A.todo) && A.todo.length) {
  const nameOf = {}; for (const b of BOOKS) nameOf[b.prefix] = b.name;
  items = A.todo.map((t) => ({ prefix: t.prefix, name: t.name || nameOf[t.prefix] || t.prefix, chapter: Number(t.chapter) }));
} else {
  for (const b of BOOKS) for (let c = 1; c <= b.chapters; c++) items.push({ prefix: b.prefix, name: b.name, chapter: c });
}

log('Übersetze ' + BOOKS.length + ' Bücher, ' + items.length + ' Kapitel — translate → verify → repair (je Kapitel sofort gespeichert).');

const results = await pipeline(
  items,
  (it) => agent(translatePrompt(it.name, it.prefix, it.chapter), { label: 'übersetzen ' + it.prefix + ' ' + it.chapter, phase: 'Übersetzen', schema: TRANSLATE_SCHEMA }).then((tr) => ({ it, translation: tr })),
  (prev) => {
    if (!prev || !prev.translation) return null;
    return agent(verifyPrompt(prev.it.name, prev.it.prefix, prev.it.chapter, prev.translation), { label: 'prüfen ' + prev.it.prefix + ' ' + prev.it.chapter, phase: 'Prüfen', schema: VERIFY_SCHEMA })
      .then((v) => ({ it: prev.it, translation: prev.translation, issues: (v && v.issues) || [], overallOk: v ? v.overallOk : true }));
  },
  (prev) => {
    if (!prev || !prev.translation) return null;
    return agent(repairPrompt(prev.it.name, prev.it.prefix, prev.it.chapter, prev.translation, prev.issues), { label: 'korrigieren+speichern ' + prev.it.prefix + ' ' + prev.it.chapter, phase: 'Korrigieren', schema: SUMMARY_SCHEMA })
      .then((s) => (s ? { prefix: prev.it.prefix, ch: prev.it.chapter, verseCount: s.verseCount, fixedCount: s.fixedCount, ok: s.ok } : null));
  }
);

const ok = results.filter(Boolean);
log('Fertig. Kapitel verarbeitet: ' + ok.length + '/' + items.length + '.');
return { chaptersProcessed: ok.length, total: items.length, perChapter: ok };
