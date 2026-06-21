export const meta = {
  name: 'markus-uebersetzen',
  description: 'Markusevangelium (16 Kap.) in 3 deutschen Stufen aus dem Griechischen: uebersetzen, adversarial pruefen, korrigieren, je Kapitel als JSON speichern.',
  phases: [
    { title: 'Übersetzen', detail: '16 Kapitel, je 3 Stufen aus dem Tischendorf-Griechisch' },
    { title: 'Prüfen', detail: 'adversariale Kontrolle jeder Stufe gegen den Urtext' },
    { title: 'Korrigieren', detail: 'Korrektur + finale Speicherung je Kapitel' },
  ],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';
const pad = (n) => String(n).padStart(2, '0');

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    verses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          v: { type: 'integer' },
          l1: { type: 'string' },
          l2: { type: 'string' },
          l3: { type: 'string' },
        },
        required: ['v', 'l1', 'l2', 'l3'],
      },
    },
  },
  required: ['verses'],
};

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    overallOk: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          v: { type: 'integer' },
          level: { type: 'string' },
          problem: { type: 'string' },
          suggestion: { type: 'string' },
          severity: { type: 'string' },
        },
        required: ['v', 'level', 'problem', 'suggestion'],
      },
    },
  },
  required: ['overallOk', 'issues'],
};

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    ch: { type: 'integer' },
    verseCount: { type: 'integer' },
    fixedCount: { type: 'integer' },
    ok: { type: 'boolean' },
  },
  required: ['ch', 'verseCount', 'ok'],
};

const filesBlock = (nn) =>
  'Lies zuerst diese Dateien VOLLSTÄNDIG:\n' +
  '1. ' + BASE + '/_raw/style_spec.md  — verbindliche Stilregeln der 3 Stufen.\n' +
  '2. ' + BASE + '/_raw/glossary.md     — verbindliche Begriffs-Wiedergaben (Konsistenz).\n' +
  '3. ' + BASE + '/_raw/ch/mk_' + nn + '.txt  — griechischer Urtext (Tischendorf), eine Zeile je Vers: "Versnummer<TAB>Griechisch".\n';

function translatePrompt(ch) {
  const nn = pad(ch);
  return (
    'Du bist Experte für Koine-Griechisch und exzellenter deutscher Übersetzer. ' +
    'Erstelle für das MARKUSEVANGELIUM, Kapitel ' + ch + ', zu JEDEM Vers DREI deutsche Fassungen.\n\n' +
    filesBlock(nn) +
    '\nAufgabe:\n' +
    '- Übersetze JEDEN Vers der Datei. Verse, die als [OMITTED] markiert sind, KOMPLETT überspringen (nicht ausgeben).\n' +
    '- Halte dich strikt an style_spec.md und glossary.md.\n' +
    '- l1 (Stufe 1, GANZ NAH AM URTEXT): sehr wörtlich/konkordant; griechische Wortstellung, historisches Präsens und Parataxe (und … und) beibehalten; Partizipien wörtlich.\n' +
    '- l2 (Stufe 2, MITTEL): genau, aber natürliches, flüssiges Deutsch.\n' +
    '- l3 (Stufe 3, GANZ FREI): heutiges Alltagsdeutsch, sehr verständlich, kurze Sätze, Alltagswortschatz statt Kirchensprache; inhaltlich treu, nichts Fremdes hinzufügen.\n' +
    '- Keine Versnummern im Text, keine eckigen Klammern, keine Fußnoten.\n\n' +
    'Gib NUR strukturierte Daten zurück: verses[] mit {v, l1, l2, l3}. Es darf kein nicht-[OMITTED]-Vers fehlen.'
  );
}

function verifyPrompt(ch, translation) {
  const nn = pad(ch);
  return (
    'Du bist ein STRENGER, adversarialer Prüfer für Bibelübersetzungen (Koine-Griechisch → Deutsch). ' +
    'Prüfe die folgende Übersetzung von MARKUS Kapitel ' + ch + ' GEGEN den griechischen Urtext.\n\n' +
    filesBlock(nn) +
    '\nZu prüfende Übersetzung (JSON, je Vers l1/l2/l3):\n' +
    JSON.stringify(translation.verses) +
    '\n\nPrüfe JEDEN Vers und JEDE Stufe streng auf:\n' +
    '- GENAUIGKEIT: Übersetzungsfehler, Sinnentstellung, falsche Bezüge, falsches Tempus/Modus.\n' +
    '- VOLLSTÄNDIGKEIT: nichts aus dem Griechischen ausgelassen; in l1/l2 nichts frei Hinzuerfundenes. (l3 darf verdeutlichen, aber nichts inhaltlich Fremdes ergänzen.)\n' +
    '- REGISTER: l1 wirklich wörtlich (Wortstellung, Präsens, Parataxe, Partizipien)? l3 wirklich einfaches Alltagsdeutsch (möglichst keine Kirchensprache wie „Buße", „Gleichnis", wenn vermeidbar)? l2 genau und natürlich?\n' +
    '- GLOSSAR/KONSISTENZ: Begriffe und Eigennamen gemäß glossary.md.\n' +
    '- DEUTSCH: Grammatik, Rechtschreibung, Flüssigkeit (je Stufe angemessen).\n\n' +
    'Melde ALLE Probleme als issues[] mit {v, level (l1|l2|l3), problem, suggestion, severity (hoch|mittel|niedrig)}. ' +
    'Sei gründlich; im Zweifel melden. Wenn wirklich alles gut ist: overallOk=true und issues leer.'
  );
}

function repairPrompt(ch, translation, issues) {
  const nn = pad(ch);
  return (
    'Du bist Lektor/Korrektor der deutschen MARKUS-Übersetzung, Kapitel ' + ch + '. ' +
    'Erstelle die ENDGÜLTIGE, korrigierte Fassung und SPEICHERE sie.\n\n' +
    filesBlock(nn) +
    '\nAktuelle Übersetzung (JSON):\n' + JSON.stringify(translation.verses) +
    '\n\nGemeldete Probleme (JSON):\n' + JSON.stringify(issues) +
    '\n\nAufgabe:\n' +
    '- Behebe alle BERECHTIGTEN Probleme (prüfe sie kurz gegen den Urtext; klar falsche Meldungen darfst du begründet ignorieren).\n' +
    '- Achte erneut strikt auf style_spec.md (l1 wörtlich, l2 mittel, l3 Alltagssprache) und glossary.md (Konsistenz).\n' +
    '- Liefere für JEDEN Vers (außer [OMITTED]) die finale Fassung {v, l1, l2, l3}.\n\n' +
    'DANACH ZWINGEND: Schreibe die finale Fassung mit dem Write-Tool als Datei nach:\n' +
    '  ' + BASE + '/_raw/out/mk_' + nn + '.json\n' +
    'Exaktes Datei-Format (gültiges JSON, korrektes Escaping):\n' +
    '  {"chapter": ' + ch + ', "verses": [{"v":1,"l1":"…","l2":"…","l3":"…"}, …]}\n' +
    'Verwende deutsche Anführungszeichen „ " ‚ ' + "'" + ' im Text (kein Escaping nötig); echte JSON-Strings mit doppelten Anführungszeichen umschließen.\n' +
    'Verifiziere gedanklich, dass die Datei valides JSON ist und alle Verse enthält.\n\n' +
    'Gib als strukturierte Antwort NUR eine Zusammenfassung zurück: {ch, verseCount, fixedCount, ok}.'
  );
}

const chapters = Array.from({ length: 16 }, (_, i) => i + 1);

log('Starte Übersetzung Markus 1–16 (3 Stufen) — translate → verify → repair, je Kapitel.');

const results = await pipeline(
  chapters,
  // Stage 1: übersetzen
  (ch) =>
    agent(translatePrompt(ch), {
      label: 'übersetzen Mk ' + ch,
      phase: 'Übersetzen',
      schema: TRANSLATE_SCHEMA,
    }).then((tr) => ({ ch, translation: tr })),
  // Stage 2: prüfen (adversarial)
  (prev) => {
    if (!prev || !prev.translation) return null;
    return agent(verifyPrompt(prev.ch, prev.translation), {
      label: 'prüfen Mk ' + prev.ch,
      phase: 'Prüfen',
      schema: VERIFY_SCHEMA,
    }).then((v) => ({ ch: prev.ch, translation: prev.translation, issues: v.issues || [], overallOk: v.overallOk }));
  },
  // Stage 3: korrigieren + speichern
  (prev) => {
    if (!prev || !prev.translation) return null;
    return agent(repairPrompt(prev.ch, prev.translation, prev.issues), {
      label: 'korrigieren+speichern Mk ' + prev.ch,
      phase: 'Korrigieren',
      schema: SUMMARY_SCHEMA,
    }).then((s) => ({ ...s, issuesReported: prev.issues.length }));
  }
);

const ok = results.filter(Boolean);
log('Fertig. Kapitel verarbeitet: ' + ok.length + '/16.');
return {
  chaptersProcessed: ok.length,
  perChapter: ok.map((r) => ({ ch: r.ch, verseCount: r.verseCount, issuesReported: r.issuesReported, fixedCount: r.fixedCount, ok: r.ok })),
};
