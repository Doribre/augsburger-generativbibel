export const meta = {
  name: 'generativbibel-seo',
  description: 'SEO-Recherche + On-Page-Empfehlung fuer die Augsburger GenerativBibel: KI-Bibel-Wettbewerb, deutsche Keyword-Landschaft, technisches SEO; Synthese mit 10 Keywords + konkreten Startseiten-Optimierungen.',
  phases: [
    { title: 'Recherche', detail: 'Wettbewerb, Keywords, technisches SEO (mit Websuche)' },
    { title: 'Synthese', detail: '10 Keywords + konkrete Startseiten-Optimierungen' },
  ],
};

const WEB_HINT = 'Nutze WebSearch/WebFetch (lade die Schemas bei Bedarf via ToolSearch "select:WebSearch,WebFetch"). Mache mehrere Suchanfragen auf Deutsch UND Englisch. Belege Aussagen mit Quellen (URL). Heutiges Datum: Juni 2026.';

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: { point: { type: 'string' }, detail: { type: 'string' }, source: { type: 'string' } }, required: ['point', 'detail'] } },
    keywords: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, intent: { type: 'string' }, competition: { type: 'string' }, note: { type: 'string' } }, required: ['term'] } },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings'],
};

const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    assessment: { type: 'string' },
    currentGaps: { type: 'array', items: { type: 'string' } },
    top10Keywords: {
      type: 'array',
      items: { type: 'object', properties: { rank: { type: 'integer' }, term: { type: 'string' }, type: { type: 'string' }, intent: { type: 'string' }, competition: { type: 'string' }, placement: { type: 'string' } }, required: ['rank', 'term', 'placement'] },
    },
    kiTerms: { type: 'object', properties: { currentState: { type: 'string' }, recommendation: { type: 'string' }, sampleCopy: { type: 'string' } }, required: ['recommendation', 'sampleCopy'] },
    headTags: { type: 'object', properties: { title: { type: 'string' }, metaDescription: { type: 'string' }, canonicalNote: { type: 'string' }, openGraph: { type: 'string' }, jsonLd: { type: 'string' } } },
    contentBlock: { type: 'string' },
    technicalActions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, impact: { type: 'string' }, effort: { type: 'string' } }, required: ['action'] } },
    rankingStrategy: { type: 'array', items: { type: 'string' } },
  },
  required: ['assessment', 'top10Keywords', 'kiTerms', 'headTags', 'technicalActions'],
};

const research = await parallel([
  () => agent(
    'Recherchiere die WETTBEWERBS- und POSITIONIERUNGS-Landschaft für eine „KI-Bibel" / KI-generierte Bibelübersetzung, deutsch- UND englischsprachig (Stand 2026).\n' + WEB_HINT + '\n\n' +
    'Beantworte: (1) Welche „KI-Bibel"/„AI Bible"/KI-Bibelübersetzungs-Projekte, Apps und Websites existieren bereits? (2) Wer rankt aktuell für Suchbegriffe wie „KI Bibel", „AI Bible", „KI Bibelübersetzung", „KI Übersetzung Bibel"? Wie besetzt/leer ist die Nische? (3) Wie positionieren sich diese (Branding, Claims, Vertrauen/Seriosität)? (4) Welche realistische Chance hat eine NEUE Seite, für „eine der ersten KI-Bibeln" gut gefunden zu werden, und über welchen Winkel (Marke „Augsburger GenerativBibel" + generische Begriffe + Vertrauen durch Transparenz/Prüfbericht)? ' +
    'Gib Findings mit Quellen und eine Keyword-Liste der Begriffe zurück, für die in dieser Nische Sichtbarkeit realistisch ist.',
    { label: 'Recherche: Wettbewerb/Nische', phase: 'Recherche', schema: RESEARCH_SCHEMA }
  ),
  () => agent(
    'Recherchiere die deutsche KEYWORD-Landschaft (Suchbegriffe + Suchintention) rund um Bibel-Lesen, Bibel-Übersetzungen und KI-Bibel (Stand 2026).\n' + WEB_HINT + '\n\n' +
    'Ermittle realistische Suchbegriffe und Long-Tail-Phrasen in mehreren Clustern: (a) KI/generativ („KI Bibel", „KI Übersetzung", „KI Bibelübersetzung", „generative Bibel"), (b) Lesen/Nutzung („Bibel online lesen", „Bibel App", „Neues Testament online", „Bibel in einfacher Sprache", „Bibel verständlich"), (c) Urtext/Wissen („Bibel Urtext", „griechischer Grundtext", „Bibel wörtliche Übersetzung", „Tischendorf", „Strong"), (d) Marke („Augsburger GenerativBibel", „Bibel TV"). ' +
    'Schätze je Begriff qualitativ Suchvolumen-Tendenz, Wettbewerb und Suchintention (informational/navigational/transaktional) ein. Markiere, welche Begriffe gut erreichbar (geringer Wettbewerb, klare Intention) sind. Gib eine priorisierte Keyword-Liste zurück.',
    { label: 'Recherche: Keywords DE', phase: 'Recherche', schema: RESEARCH_SCHEMA }
  ),
  () => agent(
    'Recherchiere TECHNISCHES On-Page-SEO 2026 speziell für eine CLIENTSEITIG (JavaScript) gerenderte Single-Page-Web-App, deren Hauptinhalt (Bibeltext) erst per JS aus JSON nachgeladen wird, gehostet u. a. auf GitHub Pages.\n' + WEB_HINT + '\n\n' +
    'Decke ab und gib konkrete, umsetzbare Empfehlungen: (1) <title> & meta description (Best Practice, Länge). (2) Canonical-URL bei mehreren Hosts (GitHub Pages vs. eigene Domain). (3) Open Graph + Twitter Cards (Social-Preview). (4) Strukturierte Daten / JSON-LD schema.org — welche Typen passen (WebSite mit SearchAction, WebApplication, CreativeWork/Book, Organization, FAQPage, BreadcrumbList)? (5) Crawlbarkeit von JS-gerendertem Inhalt: rendert Google das? Welche Risiken? Lohnt statischer/prerenderter Inhalt, ein „Über/Erklär"-Textblock im HTML, oder SSR/Prerendering? (6) robots.txt + sitemap.xml. (7) Core Web Vitals / Performance. (8) hreflang/Sprache. (9) Interne Verlinkung & Content-Tiefe (eigene URLs je Buch?). ' +
    'Gib priorisierte, konkrete Empfehlungen mit Quellen zurück.',
    { label: 'Recherche: technisches SEO', phase: 'Recherche', schema: RESEARCH_SCHEMA }
  ),
]);

const r = research.filter(Boolean);
const packed = r.map((x, i) => 'QUELLE ' + (i + 1) + ' — ' + (x.summary || '') + '\nFindings: ' + JSON.stringify(x.findings || []) + '\nKeywords: ' + JSON.stringify(x.keywords || []) + '\nEmpfehlungen: ' + JSON.stringify(x.recommendations || [])).join('\n\n');

const CURRENT_STATE =
  'AKTUELLER ZUSTAND der Startseite (index.html) der Augsburger GenerativBibel:\n' +
  '- <html lang="de">. <title>Augsburger GenerativBibel</title> (nur Marke, keine Keywords).\n' +
  '- KEINE meta description, KEIN canonical, KEINE Open-Graph-/Twitter-Tags, KEINE strukturierten Daten (JSON-LD).\n' +
  '- Google Tag Manager (GTM-WMCKZ3Z) ist eingebunden; theme-color, manifest, apple-touch-icon vorhanden.\n' +
  '- H1: „Augsburger GenerativBibel" mit Untertitel „Neues Testament · Urtextnah · mittel · Lesefluss".\n' +
  '- Hauptinhalt (Bibeltext, 27 Bücher) wird per JavaScript (js/app.js) aus JSON gerendert — im statischen HTML steht nur Header + ein Footer mit Erklärtexten (Fassungen, Urtext/Lexikon, KI-Hinweis, Transparenz/Prüfbericht, Versionszeile, Entstehungs-Satz).\n' +
  '- Hosting: Preview auf GitHub Pages (doribre.github.io/augsburger-generativbibel/); Live künftig über Bibel TV (GitLab/Docker). Produktname/Marke: „Augsburger GenerativBibel" (Bibel TV „Next Mission").\n' +
  '- WUNSCH des Auftraggebers: Die Begriffe „KI Bibel" und „KI Übersetzung" sollen GUT integriert sein, aber NICHT ganz oben (nicht im H1/Hero), sondern weiter UNTEN auf der Seite.';

phase('Synthese');
const synthesis = await agent(
  'Du bist ein erfahrener deutschsprachiger SEO-Stratege. Erstelle aus den Recherche-Ergebnissen eine konkrete, umsetzbare On-Page-SEO-Empfehlung für die Startseite der „Augsburger GenerativBibel" — eine der ersten KI-erstellten deutschen Bibelübersetzungen.\n\n' +
  CURRENT_STATE + '\n\n' +
  'RECHERCHE-ERGEBNISSE:\n' + packed + '\n\n' +
  'Liefere:\n' +
  '1. assessment: kurze Einschätzung der Ausgangslage + Chance, als „eine der ersten KI-Bibeln" gefunden zu werden.\n' +
  '2. currentGaps: die wichtigsten fehlenden SEO-Elemente.\n' +
  '3. top10Keywords: GENAU 10 Keywords (rank 1–10), je {term, type (primär/sekundär/long-tail), intent, competition, placement = WO auf der Seite/in welchem Tag}. Mische Marken-, generische KI- und Nutzungs-Begriffe; bevorzuge erreichbare Begriffe mit klarer Intention.\n' +
  '4. kiTerms: zu „KI Bibel" und „KI Übersetzung" — currentState, recommendation (ausdrücklich: NICHT im H1/Hero, sondern weiter unten im Fließtext/Erklärblock + in meta description + JSON-LD), und sampleCopy (fertiger deutscher Textvorschlag für einen unteren Seitenabschnitt, der diese Begriffe natürlich enthält).\n' +
  '5. headTags: fertige Vorschläge für title (mit Keywords, ~55–60 Zeichen), metaDescription (~150–160 Zeichen, enthält u. a. „KI"/„generativ"), canonicalNote, openGraph (og:/twitter: Tags als HTML), jsonLd (vollständiger <script type="application/ld+json"> Block mit passenden schema.org-Typen für diese Seite).\n' +
  '6. contentBlock: Vorschlag für einen zusätzlichen, crawlbaren Erklär-/„Über diese KI-Bibel"-Textabschnitt im statischen HTML (für Indexierbarkeit trotz JS-Rendering), der die Zielbegriffe natürlich unterbringt — weiter unten platziert.\n' +
  '7. technicalActions: priorisierte technische Maßnahmen je {action, impact (hoch/mittel/niedrig), effort (hoch/mittel/niedrig)} — inkl. Crawlbarkeit/Prerendering, sitemap.xml, robots.txt, Canonical/Domain, Core Web Vitals.\n' +
  '8. rankingStrategy: 3–6 strategische Schritte, um als eine der ersten KI-Bibeln gefunden zu werden (Marke aufbauen, Transparenz/Prüfbericht als Vertrauenssignal, Off-Page/PR über Bibel TV, eigene URLs je Buch etc.).\n\n' +
  'Schreibe präzise, deutsch, sofort umsetzbar. Tags/JSON-LD als gültiges HTML.',
  { label: 'Synthese: SEO-Empfehlung', phase: 'Synthese', schema: SYNTHESIS_SCHEMA }
);

return { research: r, synthesis };
