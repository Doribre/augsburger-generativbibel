export const meta = {
  name: 'at-urtext-recherche',
  description: 'Recherche: aktuellster frei verfuegbarer hebraeischer AT-Urtext (Lizenz/Aktualitaet), offenes hebraeisches Lexikon (Strong H/BDB) fuer die App, Psalmen-Besonderheiten (Zaehlung, Gottesname, Poesie). Synthese mit Empfehlung.',
  phases: [
    { title: 'Recherche', detail: 'Quelltexte/Lizenzen, Lexikon, Psalmen-Spezifika (Websuche)' },
    { title: 'Synthese', detail: 'Empfehlung für den AT-Urtext + Plan Psalmen' },
  ],
};

const WEB = 'Nutze WebSearch UND WebFetch (Schemas via ToolSearch "select:WebSearch,WebFetch" laden). Mehrere Anfragen, deutsch + englisch. Belege mit Quellen-URLs. Heutiges Datum: Juni 2026.';

const R_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: { point: { type: 'string' }, detail: { type: 'string' }, source: { type: 'string' } }, required: ['point', 'detail'] } },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings'],
};
const S_SCHEMA = {
  type: 'object',
  properties: {
    empfehlungUrtext: { type: 'string' },
    begruendung: { type: 'string' },
    lizenz: { type: 'string' },
    aktualitaet: { type: 'string' },
    zugang: { type: 'string' },
    lexikon: { type: 'string' },
    psalmenZaehlung: { type: 'string' },
    gottesname: { type: 'string' },
    lxxOption: { type: 'string' },
    appAnpassungen: { type: 'array', items: { type: 'string' } },
    offeneFragen: { type: 'array', items: { type: 'string' } },
  },
  required: ['empfehlungUrtext', 'begruendung', 'lizenz', 'zugang'],
};

const research = await parallel([
  () => agent(
    'Recherchiere die AKTUELLSTEN FREI VERFÜGBAREN hebräischen Quelltexte des Alten Testaments (Tanach/Masoretischer Text). ' + WEB + '\n\n' +
    'Decke ab: (1) Westminster Leningrad Codex (WLC) und seine gepflegten Unicode-/XML-Fassungen (UXLC / tanach.us, Groves Center), Open Scriptures Hebrew Bible (OSHB) — Stand, Pflege, Aktualität. (2) Aleppo-Codex-Ausgaben (frei?). (3) Status von BHS / Biblia Hebraica Quinta (BHQ) — sind die urheberrechtlich geschützt (Deutsche Bibelgesellschaft) und damit NICHT frei? (4) LIZENZEN jeweils (Public Domain, CC BY 4.0 etc.) — was darf man in einer öffentlichen Web-App nutzen? (5) Was ist die „aktuellste" frei verfügbare Edition (laufend korrigiert)? (6) Ketiv/Qere, Vokalisierung/Akzente, Strong-Nummern. ' +
    'Gib Findings mit Quellen + eine klare Empfehlung, welcher freie Urtext für ein seriöses, öffentliches Projekt am besten ist.',
    { label: 'Hebräische Quelltexte/Lizenzen', phase: 'Recherche', schema: R_SCHEMA }
  ),
  () => agent(
    'Recherchiere OFFENE/frei lizenzierte HEBRÄISCHE LEXIKA für eine Web-App, die beim Antippen eines hebräischen Wortes Lemma + Bedeutung + Strong-Nummer zeigt (Pendant zum Strong-Greek-Lexikon des NT). ' + WEB + '\n\n' +
    'Decke ab: (1) Strong\'s Hebrew Dictionary (H-Nummern) — offene JSON-Fassungen (z. B. OpenScriptures StrongHebrewG/strongs, openscriptures/HebrewLexicon, BDB — Brown-Driver-Briggs). Lizenzen (CC BY-SA / Public Domain?). (2) Wie verknüpft man hebräische Wörter mit Strong-H-Nummern (WLC/WLCa mit Strong, OSHB-Morphologie)? (3) Deutsche Kurzbedeutungen — gibt es offene deutsche Glossen, oder müssen sie (wie beim NT) aus den englischen abgeleitet/KI-übersetzt werden? (4) Besonderheiten: Wurzeln, Rechts-nach-links (RTL)-Darstellung. ' +
    'Gib konkrete Quellen/Repos + Empfehlung, womit das Hebräisch-Lexikon der App befüllt werden kann.',
    { label: 'Hebräisches Lexikon (offen)', phase: 'Recherche', schema: R_SCHEMA }
  ),
  () => agent(
    'Recherchiere die ÜBERSETZUNGS- und DARSTELLUNGS-BESONDERHEITEN der PSALMEN aus dem hebräischen Urtext (für eine deutsche Lesefassung). ' + WEB + '\n\n' +
    'Decke ab: (1) ZÄHLUNG: Unterschiede masoretische vs. Septuaginta/Vulgata-Zählung (z. B. Ps 9/10, 114/115, 116, 147) — welche Zählung sollte eine deutsche Ausgabe nutzen (i. d. R. masoretisch, wie EÜ/LUT)? (2) ÜBERSCHRIFTEN/Superscriptionen: Im Hebräischen oft Vers 1 (z. B. „Ein Psalm Davids") — wie zählen deutsche Übersetzungen das (EÜ zählt die Überschrift mit, LUT teils nicht)? Konsequenz für Versnummern. (3) GOTTESNAME JHWH (Tetragramm): übliche deutsche Wiedergabe („der HERR" in Kapitälchen; EÜ „der HERR"; einige „Jahwe") — Empfehlung für Urtextnah vs. fließend. (4) HEBRÄISCHE POESIE: Parallelismus, Knappheit, Bildsprache — was heißt das für eine wörtliche (Urtextnah) vs. flüssige Fassung? (5) Selah. ' +
    'Gib Findings mit Quellen + Empfehlungen für Zählung, Überschriften-Handhabung und Gottesname.',
    { label: 'Psalmen-Spezifika', phase: 'Recherche', schema: R_SCHEMA }
  ),
]);

const r = research.filter(Boolean);
const packed = r.map((x, i) => 'QUELLE ' + (i + 1) + ' — ' + (x.summary || '') + '\nFindings: ' + JSON.stringify(x.findings || []) + '\nEmpfehlungen: ' + JSON.stringify(x.recommendations || [])).join('\n\n');

const CONTEXT =
  'PROJEKT „Augsburger GenerativBibel": NT bereits fertig (27 Bücher, 3 Fassungen, Urtext Tischendorf via bolls.life mit Strong-Greek-Lexikon). Jetzt Start ins ALTE TESTAMENT, erstes Buch = Psalmen. ' +
  'Vorgabe: pro Text nur 2 veröffentlichte Fassungen — „Urtextnah" und „fließend/Lesefluss" (kein „Mittel"; Mittel wird intern als Qualitätsanker mit-erzeugt). ' +
  'PRAKTISCHER BEFUND (verifiziert): bolls.life liefert den hebräischen Urtext, u. a. „WLCa" = Westminster Leningrad Codex mit Vokalen, Akzenten UND Strong-Nummern (Buch 19 = Psalmen; Endpoint analog NT: https://bolls.life/get-text/WLCa/19/<kapitel>/). Damit wäre dieselbe Fetch-Pipeline wie beim NT nutzbar. App zeigt Urtext aktuell links-nach-rechts (Griechisch); Hebräisch braucht RTL.';

phase('Synthese');
const synthesis = await agent(
  'Du bist Fachreferent für Bibelübersetzung/Hebraistik und technischer Architekt. Fasse die Recherche zu einer klaren, umsetzbaren Empfehlung für den AT-Urtext der Augsburger GenerativBibel zusammen (Start: Psalmen).\n\n' +
  CONTEXT + '\n\nRECHERCHE:\n' + packed + '\n\n' +
  'Liefere: empfehlungUrtext (welche konkrete freie Edition + Bezug, idealerweise via bolls.life WLCa, mit Begründung warum das die aktuellste sinnvolle freie Wahl ist); begruendung; lizenz (darf man es öffentlich nutzen?); aktualitaet; zugang (genauer Abruf-Weg, Endpoint, Strong-Nummern); lexikon (woher das hebräische Wort-Lexikon Strong-H + deutsche Glossen, Lizenz); psalmenZaehlung (welche Zählung + warum); gottesname (Empfehlung JHWH-Wiedergabe für Urtextnah und fließend); lxxOption (Septuaginta als optionale Zweitquelle ja/nein); appAnpassungen (Liste: RTL-Hebräisch, 2-Fassungen-Slider statt 3, Hebräisch-Lexikon, Buch-Katalog AT, Zählungs-/Überschriften-Logik); offeneFragen (was der Nutzer entscheiden muss). Präzise, deutsch, mit Quellen wo möglich.',
  { label: 'Synthese: AT-Urtext-Empfehlung', phase: 'Synthese', schema: S_SCHEMA }
);

return { research: r, synthesis };
