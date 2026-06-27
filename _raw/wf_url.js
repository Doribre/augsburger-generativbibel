export const meta = {
  name: 'bibelstellen-url-standard',
  description: 'Recherche + Empfehlung fuer den idealen URL-Standard von Bibelstellen (z. B. Matthaeus 22,5) fuer deutsche SEO und Suchverhalten; Grundlage fuer das Prerendering der GenerativBibel.',
  phases: [
    { title: 'Recherche', detail: 'Wettbewerber-URLs, deutsches Suchverhalten, SEO-Best-Practice' },
    { title: 'Synthese', detail: 'konkreter URL-Standard + Beispiel Matthäus 22,5' },
  ],
};

const WEB = 'Nutze WebSearch UND WebFetch (Schemas via ToolSearch "select:WebSearch,WebFetch" laden). Mache mehrere Anfragen auf Deutsch. Belege mit konkreten URLs/Beispielen. Heutiges Datum: Juni 2026.';

const R_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: { point: { type: 'string' }, detail: { type: 'string' }, example: { type: 'string' }, source: { type: 'string' } }, required: ['point', 'detail'] } },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings'],
};

const S_SCHEMA = {
  type: 'object',
  properties: {
    recommendedPattern: { type: 'string' },
    rationale: { type: 'string' },
    bookSlugScheme: { type: 'string' },
    verseHandling: { type: 'string' },
    rangeHandling: { type: 'string' },
    exampleUrls: { type: 'array', items: { type: 'object', properties: { reference: { type: 'string' }, url: { type: 'string' }, note: { type: 'string' } }, required: ['reference', 'url'] } },
    titlePattern: { type: 'string' },
    canonicalRule: { type: 'string' },
    sitemapRule: { type: 'string' },
    internalLinking: { type: 'string' },
    abbreviationsRedirects: { type: 'string' },
    alternativesConsidered: { type: 'array', items: { type: 'string' } },
    pitfalls: { type: 'array', items: { type: 'string' } },
  },
  required: ['recommendedPattern', 'rationale', 'exampleUrls', 'verseHandling'],
};

const research = await parallel([
  () => agent(
    'Untersuche, wie etablierte BIBEL-PORTALE ihre URLs für eine konkrete Bibelstelle (Beispiel: „Matthäus 22,5") aufbauen. ' + WEB + '\n\n' +
    'Prüfe konkret (mit WebFetch die echten URLs ansehen) mindestens: bibleserver.com (ERF), die-bibel.de (Deutsche Bibelgesellschaft), bibel-online.net, bibleserver/YouVersion bible.com, ggf. bibelwissenschaft.de, sermon-online, gotquestions. ' +
    'Erfasse je Portal das URL-MUSTER für: (a) ein ganzes Kapitel, (b) einen einzelnen Vers, (c) einen Versbereich. Achte auf: Buchname als Slug (ausgeschrieben „matthaeus" vs. Kürzel „mt" vs. USFM-Code „MAT"), Umlaut-Behandlung (ä → „ae" / „%C3%A4" / „ä"), Trennzeichen Kapitel/Vers (Punkt „22.5", Komma „22,5", Slash „/22/5", Anker „#5"), Übersetzungs-/Versions-Code im Pfad, Klein-/Großschreibung, Trailing-Slash. ' +
    'Gib pro Portal ein konkretes Beispiel-URL-Schema in findings.example zurück. Schließe mit recommendations, welches Muster für deutsche Nutzer am gängigsten/erwartbarsten ist.',
    { label: 'URLs der Bibelportale', phase: 'Recherche', schema: R_SCHEMA }
  ),
  () => agent(
    'Untersuche, WIE deutschsprachige Nutzer Bibelstellen in Google EINGEBEN und SUCHEN, und wie Google damit umgeht (Stand 2026). ' + WEB + '\n\n' +
    'Beantworte: (1) Welche Schreibweisen tippen Menschen? („Matthäus 22,5" mit Komma, „Matthäus 22 5", „Mt 22,5", „Matthäus 22 Vers 5", „matthäus kapitel 22", englisch „Matthew 22:5"). Was sagen Google-Autocomplete/„ähnliche Suchanfragen"? (2) Behandelt Google Komma/Doppelpunkt/Leerzeichen zwischen Kapitel und Vers äquivalent? Wie wichtig ist die exakte Schreibweise in der URL? (3) Welche Seiten ranken aktuell für solche Stellen-Suchen, und mit welcher URL-Form? (4) Gibt es Rich Results / Featured Snippets / Knowledge Panel für Bibelverse? (5) Suchen Nutzer eher ganze Kapitel oder einzelne Verse? ' +
    'Gib konkrete Beispiele/Quellen und am Ende recommendations zur URL-Form, die das reale Suchverhalten am besten bedient.',
    { label: 'Deutsches Suchverhalten', phase: 'Recherche', schema: R_SCHEMA }
  ),
  () => agent(
    'Recherchiere SEO-BEST-PRACTICE für URLs einer großen, deutschsprachigen Inhaltssammlung (Bibel: 27 Bücher, ~260 Kapitel, ~7.958 Verse), die statisch prerendert wird. ' + WEB + '\n\n' +
    'Decke ab und gib konkrete Empfehlungen: (1) Lesbare, keyword-reiche Slugs: Umlaut-Transliteration ä→ae/ö→oe/ü→ue/ß→ss vs. Beibehaltung vs. Prozent-Encoding — was empfiehlt Google für deutsche URLs? (2) Klein­schreibung, Bindestriche, Trailing-Slash-Konsistenz. (3) KAPITEL-Seiten vs. VERS-Seiten: Sind ~7.958 Einzelvers-Seiten „thin content"/Risiko, oder besser Kapitel-Seiten mit Vers-Ankern? Wie verlinkt man einen Einzelvers (Anker #v5 vs. eigener Pfad)? (4) Versbereiche (22,1-14) und Verslisten — eigene URL, Parameter oder Canonical aufs Kapitel? (5) Canonical-Strategie (Vers→Kapitel?), Paginierung/next-prev zwischen Kapiteln, Breadcrumbs/BreadcrumbList-Schema. (6) Sitemap-Granularität (Kapitel-URLs). (7) hreflang (nur de) und strukturierte Daten je Kapitelseite. ' +
    'Gib priorisierte, konkrete Empfehlungen mit Quellen.',
    { label: 'SEO-URL-Best-Practice', phase: 'Recherche', schema: R_SCHEMA }
  ),
]);

const r = research.filter(Boolean);
const packed = r.map((x, i) => 'QUELLE ' + (i + 1) + ' — ' + (x.summary || '') + '\nFindings: ' + JSON.stringify(x.findings || []) + '\nEmpfehlungen: ' + JSON.stringify(x.recommendations || [])).join('\n\n');

const CONTEXT =
  'PROJEKT: „Augsburger GenerativBibel" — vollständiges Neues Testament (27 Bücher, ~260 Kapitel), deutsch, KI-übersetzt, 3 Lesefassungen (urtextnah/mittel/Lesefluss). ' +
  'Live-Hauptdomain: https://www.generativ-bibel.de/ (Canonical; generativbibel.de → 301). Aktuell SPA, Bibeltext per JS aus JSON; Stellen-Verlinkung bisher per Hash (#1,1-8). ' +
  'Ziel: statisches Prerendering je Kapitel, damit Crawler echten Text sehen und Stellen-Suchen („Matthäus 22,5") die Seite über die URL finden. Buch-IDs intern z. B. matthaeus, markus, 1korinther, offenbarung. Deutsche Stellen-Konvention: „Buch Kapitel,Vers" (Komma).';

phase('Synthese');
const synthesis = await agent(
  'Du bist technischer SEO-Architekt. Lege auf Basis der Recherche den IDEALEN, konkreten URL-STANDARD für Bibelstellen der Augsburger GenerativBibel fest — optimiert für deutsches Suchverhalten UND SEO.\n\n' +
  CONTEXT + '\n\nRECHERCHE:\n' + packed + '\n\n' +
  'Liefere eine umsetzbare Spezifikation: recommendedPattern (das eine, klare URL-Schema, z. B. „/<buch-slug>/<kapitel>/" mit Vers-Anker); rationale; bookSlugScheme (genaue Slug-Bildung inkl. Umlaut-Transliteration und Liste kritischer NT-Buch-Slugs wie matthaeus, 1korinther, offenbarung); verseHandling (wie wird „Matthäus 22,5" adressiert — Anker #5/#v5 auf der Kapitelseite, oder eigene Versseite? mit Begründung Thin-Content); rangeHandling (22,1-14 und Verslisten); exampleUrls (konkrete volle URLs für: Matthäus 22 (Kapitel), Matthäus 22,5 (Einzelvers), Matthäus 22,1-14 (Bereich), 1. Korinther 13, Offenbarung 22); titlePattern (z. B. „Matthäus 22 – Augsburger GenerativBibel"); canonicalRule; sitemapRule; internalLinking; abbreviationsRedirects (Mt→matthaeus etc., 301?); alternativesConsidered; pitfalls. ' +
  'Triff eine klare EMPFEHLUNG (kein Sowohl-als-auch). Begründe besonders die Frage Kapitel-Seite-mit-Anker vs. eigene Vers-Seite für „Matthäus 22,5".',
  { label: 'Synthese: URL-Standard', phase: 'Synthese', schema: S_SCHEMA }
);

return { research: r, synthesis };
